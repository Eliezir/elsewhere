import { BrowserWindow, dialog, ipcMain, shell } from "electron";
import { TAILSCALE_APP } from "./config";
import { IPC, IconInputSchema, IconRepoSchema, MacInputSchema, MoveRequestSchema, TerminalInputSchema, VmInputSchema, type MoveResult } from "@vmc/shared";
import { runMove, writeMoveRecord, defaultRecordDir } from "./services/move/flow";
import { sshRemote } from "./services/move/remote";
import { isAllowedLoginUrl } from "./services/urls";
import { getTailscaleStatus } from "./services/tailscale";
import { connectTailscale, disconnectTailscale } from "./services/tailscaleControl";
import { openVmTerminal } from "./services/terminal";
import { readUsage, refreshUsage } from "./services/usage";
import { getVmSnapshot } from "./services/vm";
import { clearCustomIcon, getProjectIcons, saveCustomIcon } from "./services/projectIcon";
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
  ipcMain.handle(IPC.projectIcons, (_event, input: unknown) => getProjectIcons(IconInputSchema.parse(input).projects));
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
