import { BrowserWindow, ipcMain } from "electron";
import { IPC, MacInputSchema, MoveRequestSchema, TerminalInputSchema, VmInputSchema, type MoveResult } from "@vmc/shared";
import { runMove, writeMoveRecord, defaultRecordDir } from "./services/move/flow";
import { sshRemote } from "./services/move/remote";
import { getTailscaleStatus } from "./services/tailscale";
import { openVmTerminal } from "./services/terminal";
import { readUsage, refreshUsage } from "./services/usage";
import { getVmSnapshot } from "./services/vm";
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
  ipcMain.handle(IPC.openMainWindow, (_event, section: unknown) => {
    actions.openMainWindow(typeof section === "string" ? section : undefined);
  });
  ipcMain.handle(IPC.macWorktrees, (_event, input: unknown) => listMacWorktrees(MacInputSchema.parse(input).repos));
  ipcMain.handle(IPC.vmSnapshot, (_event, input: unknown) => {
    const parsed = VmInputSchema.parse(input);
    return getVmSnapshot(parsed.target, parsed.repos);
  });
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
