import { stat } from "node:fs/promises";
import { BrowserWindow, clipboard, dialog, ipcMain, shell } from "electron";
import { TAILSCALE_APP } from "./config";
import { DeleteRequestSchema, AppPrefsSchema, ForwardConfigSchema, IPC, ShutdownArmSchema, HostAppInputSchema, LanMouseInputSchema, GamingInputSchema, PowerInputSchema, ShutdownTargetSchema, TwinSyncInputSchema, VmStorageInputSchema, PathsInputSchema, ToolOpenInputSchema, IconInputSchema, IconRepoSchema, PruneInputSchema, SizeInputSchema, MacInputSchema, MoveRequestSchema, TerminalInputSchema, VmInputSchema, WakeInputSchema, RemoteT3InputSchema, type DeleteResult, type MoveResult } from "@vmc/shared";
import { runMove, writeMoveRecord, defaultRecordDir } from "./services/move/flow";
import { sshRemote } from "./services/move/remote";
import { isAllowedLoginUrl } from "./services/urls";
import { getTailscaleStatus } from "./services/tailscale";
import { connectTailscale, disconnectTailscale } from "./services/tailscaleControl";
import { openMacTerminal, openVmTerminal } from "./services/terminal";
import { getVmSnapshot } from "./services/vm";
import { compareTwins } from "./services/move/twin";
import { refreshLink, setForwardConfig } from "./services/forwardLoop";
import { getLinkStatus } from "./services/link";
import { setPrefs } from "./services/prefs";
import { getVmStorage } from "./services/vmStorage";
import { getMacStorage } from "./services/macStorage";
import { controlHostApp } from "./services/hostApp";
import { lanMouse } from "./services/lanMouse";
import { sendTestNotification } from "./services/notifications";
import { startGamingMode } from "./services/pcMode";
import { powerAction } from "./services/power";
import { armShutdown, disarmShutdown, getShutdownStatus } from "./services/shutdown";
import { deleteWorktree, prune } from "./services/cleanup";
import { clearCustomIcon, getProjectIcons, saveCustomIcon } from "./services/projectIcon";
import { getT3Threads, getToolsInfo, openInTool } from "./services/tools";
import { sizeService } from "./services/sizes";
import { listMacWorktrees } from "./services/worktrees";
import { wakeHost } from "./services/wake";
import { openInRemoteT3 } from "./services/t3Remote";

export interface IpcActions {
  openMainWindow: (section?: string) => void;
}

let moving = false;

function broadcast(channel: string, payload: unknown): void {
  for (const window of BrowserWindow.getAllWindows()) window.webContents.send(channel, payload);
}

export function registerIpc(actions: IpcActions): void {
  ipcMain.handle(IPC.tailscaleStatus, (_event, name: unknown) => getTailscaleStatus(typeof name === "string" && /^[A-Za-z0-9-]{1,63}$/.test(name) ? name : undefined));
  ipcMain.handle(IPC.tailscaleConnect, () => connectTailscale());
  ipcMain.handle(IPC.tailscaleDisconnect, () => disconnectTailscale());
  ipcMain.handle(IPC.openApproval, async (_event, url: unknown) => {
    if (typeof url !== "string" || !isAllowedLoginUrl(url)) return false;
    await shell.openExternal(url);
    return true;
  });
  ipcMain.handle(IPC.remoteT3Open, (_event, input: unknown) => openInRemoteT3(RemoteT3InputSchema.parse(input)));
  ipcMain.handle(IPC.wakeHost, (_event, input: unknown) => wakeHost(WakeInputSchema.parse(input).mac));
  ipcMain.handle(IPC.openTailscale, async () => {
    const error = await shell.openPath(TAILSCALE_APP);
    return error === "" ? null : error;
  });
  ipcMain.handle(IPC.openMainWindow, (_event, section: unknown) => {
    actions.openMainWindow(typeof section === "string" ? section : undefined);
  });
  ipcMain.handle(IPC.macWorktrees, (_event, input: unknown) => listMacWorktrees(MacInputSchema.parse(input).repos));
  ipcMain.handle(IPC.vmSnapshot, (_event, input: unknown) => {
    const parsed = VmInputSchema.parse(input);
    return getVmSnapshot(parsed.target, parsed.repos);
  });
  ipcMain.handle(IPC.linkStatus, () => getLinkStatus());
  ipcMain.handle(IPC.linkRefresh, () => refreshLink());
  ipcMain.handle(IPC.appPrefs, (_event, input: unknown) => setPrefs(AppPrefsSchema.parse(input)));
  ipcMain.handle(IPC.forwardConfig, (_event, input: unknown) => setForwardConfig(ForwardConfigSchema.parse(input)));
  ipcMain.handle(IPC.vmStorage, (_event, input: unknown) => getVmStorage(VmStorageInputSchema.parse(input).target));
  ipcMain.handle(IPC.power, (_event, input: unknown) => {
    const parsed = PowerInputSchema.parse(input);
    return powerAction(parsed.target, parsed.action, parsed.force === true);
  });
  ipcMain.handle(IPC.gamingMode, (_event, input: unknown) => {
    const parsed = GamingInputSchema.parse(input);
    return startGamingMode(parsed.target, parsed.force === true);
  });
  ipcMain.handle(IPC.notifyTest, () => sendTestNotification());
  ipcMain.handle(IPC.lanMouse, (_event, input: unknown) => lanMouse.control(LanMouseInputSchema.parse(input)));
  ipcMain.handle(IPC.hostApp, (_event, input: unknown) => {
    const parsed = HostAppInputSchema.parse(input);
    return controlHostApp(parsed.target, parsed.action);
  });
  ipcMain.handle(IPC.macStorage, () => getMacStorage());
  ipcMain.handle(IPC.shutdownStatus, (_event, input: unknown) => getShutdownStatus(ShutdownTargetSchema.parse(input).target));
  ipcMain.handle(IPC.shutdownArm, (_event, input: unknown) => {
    const parsed = ShutdownArmSchema.parse(input);
    return armShutdown(parsed.target, parsed);
  });
  ipcMain.handle(IPC.shutdownDisarm, (_event, input: unknown) => disarmShutdown(ShutdownTargetSchema.parse(input).target));
  ipcMain.handle(IPC.projectIcons, (_event, input: unknown) => getProjectIcons(IconInputSchema.parse(input).projects));
  ipcMain.handle(IPC.toolsInfo, () => getToolsInfo());
  ipcMain.handle(IPC.t3Threads, (_event, input: unknown) => getT3Threads(PathsInputSchema.parse(input).paths));
  ipcMain.handle(IPC.toolOpen, (_event, input: unknown) => {
    const parsed = ToolOpenInputSchema.parse(input);
    return openInTool(parsed.tool, parsed.path);
  });
  ipcMain.handle(IPC.reveal, async (_event, path: unknown) => {
    if (typeof path !== "string" || !path.startsWith("/")) return false;
    const exists = await stat(path).then(() => true, () => false);
    if (exists) shell.showItemInFolder(path);
    return exists;
  });
  ipcMain.handle(IPC.sizes, (_event, input: unknown) => sizeService.get(SizeInputSchema.parse(input)));
  ipcMain.handle(IPC.prunePreview, (_event, input: unknown) => prune(PruneInputSchema.parse(input), true));
  ipcMain.handle(IPC.pruneRun, (_event, input: unknown) => prune(PruneInputSchema.parse(input), false));
  ipcMain.handle(IPC.deleteWorktree, async (_event, input: unknown): Promise<DeleteResult> => {
    const request = DeleteRequestSchema.parse(input);
    if (moving) return { ok: false, needsForce: false, error: "A move is running. Try again when it finishes.", notes: [] };
    if (request.location === "vm" && request.target === null) return { ok: false, needsForce: false, error: "No VM is configured.", notes: [] };
    const result = await deleteWorktree(request);
    if (result.ok) sizeService.forget(`${request.location}:${request.path}`);
    return result;
  });
  ipcMain.handle(IPC.iconChoose, async (_event, input: unknown) => {
    const { repo } = IconRepoSchema.parse(input);
    const options = { title: "Choose a project icon", properties: ["openFile" as const], filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "svg"] }] };
    const parent = BrowserWindow.getFocusedWindow();
    const picked = parent ? await dialog.showOpenDialog(parent, options) : await dialog.showOpenDialog(options);
    const file = picked.filePaths[0];
    if (picked.canceled || file === undefined) return { ok: false, cancelled: true, error: null };
    return saveCustomIcon(repo, file);
  });
  ipcMain.handle(IPC.iconClear, async (_event, input: unknown) => clearCustomIcon(IconRepoSchema.parse(input).repo));
  ipcMain.handle(IPC.openMacTerminal, (_event, path: unknown) => openMacTerminal(path));
  ipcMain.handle(IPC.openTerminal, (_event, input: unknown) => openVmTerminal(TerminalInputSchema.parse(input)));
  ipcMain.handle(IPC.twinSync, (_event, input: unknown) => compareTwins(TwinSyncInputSchema.parse(input)));
  ipcMain.handle(IPC.moveStart, async (_event, input: unknown): Promise<MoveResult> => {
    const request = MoveRequestSchema.parse(input);
    if (moving) return { ok: false, error: "Another move is already running.", note: null, vmPath: null };
    moving = true;
    try {
      const result = await runMove(request, sshRemote(request.target), (progress) => broadcast(IPC.moveProgress, progress));
      await writeMoveRecord(request, result, defaultRecordDir());
      if (result.ok && request.direction === "to-vm" && request.hostRepo) {
        clipboard.writeText(request.branch);
        return { ...result, note: `${result.note ?? ""} The branch name is on your clipboard.`.trim() };
      }
      return result;
    } finally {
      moving = false;
    }
  });
}
