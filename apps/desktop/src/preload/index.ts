import { contextBridge, ipcRenderer } from "electron";
import { IPC, type Api } from "@vmc/shared/bridge";

const api: Api = {
  getTailscaleStatus: () => ipcRenderer.invoke(IPC.tailscaleStatus),
  getUsage: () => ipcRenderer.invoke(IPC.usage),
  refreshUsage: () => ipcRenderer.invoke(IPC.usageRefresh),
  getMacWorktrees: (repos) => ipcRenderer.invoke(IPC.macWorktrees, { repos }),
  getVmSnapshot: (input) => ipcRenderer.invoke(IPC.vmSnapshot, input),
  startMove: (request) => ipcRenderer.invoke(IPC.moveStart, request),
  onMoveProgress: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, progress: Parameters<typeof listener>[0]) => listener(progress);
    ipcRenderer.on(IPC.moveProgress, handler);
    return () => {
      ipcRenderer.removeListener(IPC.moveProgress, handler);
    };
  },
  openTailscale: () => ipcRenderer.invoke(IPC.openTailscale),
  openVmTerminal: (input) => ipcRenderer.invoke(IPC.openTerminal, input),
  openMainWindow: (section) => ipcRenderer.invoke(IPC.openMainWindow, section),
  onNavigate: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, section: string) => listener(section);
    ipcRenderer.on(IPC.navigate, handler);
    return () => {
      ipcRenderer.removeListener(IPC.navigate, handler);
    };
  },
};

contextBridge.exposeInMainWorld("api", api);
