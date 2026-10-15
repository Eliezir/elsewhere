import { ipcMain } from "electron";
import { IPC } from "@vmc/shared";
import { getTailscaleStatus } from "./services/tailscale";

export interface IpcActions {
  openMainWindow: (section?: string) => void;
}

export function registerIpc(actions: IpcActions): void {
  ipcMain.handle(IPC.tailscaleStatus, () => getTailscaleStatus());
  ipcMain.handle(IPC.openMainWindow, (_event, section: unknown) => {
    actions.openMainWindow(typeof section === "string" ? section : undefined);
  });
}
