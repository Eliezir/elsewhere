import { contextBridge, ipcRenderer } from "electron";
import { IPC, type Api } from "@vmc/shared/bridge";

const api: Api = {
  getTailscaleStatus: () => ipcRenderer.invoke(IPC.tailscaleStatus),
  getUsage: () => ipcRenderer.invoke(IPC.usage),
  refreshUsage: () => ipcRenderer.invoke(IPC.usageRefresh),
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
