import { stat } from "node:fs/promises";
import { BrowserWindow, dialog, ipcMain, shell } from "electron";
import { TAILSCALE_APP } from "./config";
import { DeleteRequestSchema, ClaudeDesktopOpenSchema, IPC, KillPortSchema, LocalPortSchema, PortForwardToggleSchema, VmPortsInputSchema, VmStorageInputSchema, VmT3InputSchema, VmT3OpenSchema, PathsInputSchema, ToolOpenInputSchema, IconInputSchema, IconRepoSchema, PruneInputSchema, SizeInputSchema, MacInputSchema, MoveRequestSchema, TerminalInputSchema, VmInputSchema, type DeleteResult, type MoveResult } from "@vmc/shared";
import { runMove, writeMoveRecord, defaultRecordDir } from "./services/move/flow";
import { sshRemote } from "./services/move/remote";
import { isAllowedLoginUrl } from "./services/urls";
import { getTailscaleStatus } from "./services/tailscale";
import { connectTailscale, disconnectTailscale } from "./services/tailscaleControl";
import { openMacTerminal, openVmTerminal } from "./services/terminal";
import { readUsage, refreshUsage } from "./services/usage";
import { getVmSnapshot } from "./services/vm";
import { setForward } from "./services/forwards";
import { openInClaudeDesktop } from "./services/claudeDesktop";
import { getVmPorts, killVmPort } from "./services/vmPorts";
import { getVmStorage } from "./services/vmStorage";
import { deleteWorktree, prune } from "./services/cleanup";
import { clearCustomIcon, getProjectIcons, saveCustomIcon } from "./services/projectIcon";
import { getVmT3, openVmInT3 } from "./services/t3Remote";
import { getT3Threads, getToolsInfo, openInTool } from "./services/tools";
import { sizeService } from "./services/sizes";
import { listMacWorktrees } from "./services/worktrees";

export interface IpcActions {
  openMainWindow: (section?: string) => void;
}

let moving = false;

function broadcast(channel: string, payload: unknown): void {
  for (const window of BrowserWindow.getAllWindows()) window.webContents.send(channel, payload);
}

export function registerIpc(actions: IpcActions): void {
  ipcMain.handle(IPC.usage, () => readUsage());
  ipcMain.handle(IPC.usageRefresh, async () => {
    await refreshUsage();
    return readUsage();
  });
  ipcMain.handle(IPC.tailscaleStatus, () => getTailscaleStatus());
  ipcMain.handle(IPC.tailscaleConnect, () => connectTailscale());
  ipcMain.handle(IPC.tailscaleDisconnect, () => disconnectTailscale());
  ipcMain.handle(IPC.openApproval, async (_event, url: unknown) => {
    if (typeof url !== "string" || !isAllowedLoginUrl(url)) return false;
    await shell.openExternal(url);
    return true;
  });
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
  ipcMain.handle(IPC.vmPorts, (_event, input: unknown) => {
    const parsed = VmPortsInputSchema.parse(input);
    return getVmPorts(parsed.target, parsed.autoForward);
  });
  ipcMain.handle(IPC.vmPortForward, async (_event, input: unknown) => {
    const parsed = PortForwardToggleSchema.parse(input);
    await setForward(parsed.target, parsed.port, parsed.enabled);
    return getVmPorts(parsed.target, false);
  });
  ipcMain.handle(IPC.claudeDesktopOpen, (_event, input: unknown) => {
    const parsed = ClaudeDesktopOpenSchema.parse(input);
    return openInClaudeDesktop(parsed.target, parsed.path);
  });
  ipcMain.handle(IPC.vmPortKill, (_event, input: unknown) => {
    const parsed = KillPortSchema.parse(input);
    return killVmPort(parsed.target, parsed.port, parsed.force);
  });
  ipcMain.handle(IPC.openLocalPort, async (_event, port: unknown) => {
    const parsed = LocalPortSchema.safeParse(port);
    if (!parsed.success) return false;
    await shell.openExternal(`http://localhost:${parsed.data}`);
    return true;
  });
  ipcMain.handle(IPC.vmStorage, (_event, input: unknown) => getVmStorage(VmStorageInputSchema.parse(input).target));
  ipcMain.handle(IPC.projectIcons, (_event, input: unknown) => getProjectIcons(IconInputSchema.parse(input).projects));
  ipcMain.handle(IPC.vmT3, (_event, input: unknown) => {
    const parsed = VmT3InputSchema.parse(input);
    return getVmT3(parsed.target, parsed.paths);
  });
  ipcMain.handle(IPC.vmT3Open, (_event, input: unknown) => {
    const parsed = VmT3OpenSchema.parse(input);
    return openVmInT3(parsed.target, parsed.path);
  });
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
  ipcMain.handle(IPC.moveStart, async (_event, input: unknown): Promise<MoveResult> => {
    const request = MoveRequestSchema.parse(input);
    if (moving) return { ok: false, error: "Another move is already running.", note: null, vmPath: null };
    moving = true;
    try {
      const result = await runMove(request, sshRemote(request.target), (progress) => broadcast(IPC.moveProgress, progress));
      await writeMoveRecord(request, result, defaultRecordDir());
      return result;
    } finally {
      moving = false;
    }
  });
}
