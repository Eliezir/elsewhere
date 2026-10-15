import { contextBridge, ipcRenderer } from "electron";
import { IPC, type Api } from "@vmc/shared/bridge";

const api: Api = {
  platform: process.platform,
  getTailscaleStatus: () => ipcRenderer.invoke(IPC.tailscaleStatus),
  getUsage: () => ipcRenderer.invoke(IPC.usage),
  refreshUsage: () => ipcRenderer.invoke(IPC.usageRefresh),
  getMacWorktrees: (repos) => ipcRenderer.invoke(IPC.macWorktrees, { repos }),
  getVmPorts: (input) => ipcRenderer.invoke(IPC.vmPorts, input),
  setPortForward: (input) => ipcRenderer.invoke(IPC.vmPortForward, input),
  openLocalPort: (port) => ipcRenderer.invoke(IPC.openLocalPort, port),
  getVmStorage: (input) => ipcRenderer.invoke(IPC.vmStorage, input),
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
  getProjectIcons: (input) => ipcRenderer.invoke(IPC.projectIcons, input),
  getTools: () => ipcRenderer.invoke(IPC.toolsInfo),
  getVmT3: (input) => ipcRenderer.invoke(IPC.vmT3, input),
  openVmInT3: (input) => ipcRenderer.invoke(IPC.vmT3Open, input),
  getT3Threads: (paths) => ipcRenderer.invoke(IPC.t3Threads, { paths }),
  openInTool: (input) => ipcRenderer.invoke(IPC.toolOpen, input),
  revealInFinder: (path) => ipcRenderer.invoke(IPC.reveal, path),
  getWorktreeSizes: (input) => ipcRenderer.invoke(IPC.sizes, input),
  previewPrune: (input) => ipcRenderer.invoke(IPC.prunePreview, input),
  runPrune: (input) => ipcRenderer.invoke(IPC.pruneRun, input),
  deleteWorktree: (request) => ipcRenderer.invoke(IPC.deleteWorktree, request),
  chooseProjectIcon: (repo) => ipcRenderer.invoke(IPC.iconChoose, { repo }),
  clearProjectIcon: (repo) => ipcRenderer.invoke(IPC.iconClear, { repo }),
  openApproval: (url) => ipcRenderer.invoke(IPC.openApproval, url),
  connectTailscale: () => ipcRenderer.invoke(IPC.tailscaleConnect),
  disconnectTailscale: () => ipcRenderer.invoke(IPC.tailscaleDisconnect),
  openVmTerminal: (input) => ipcRenderer.invoke(IPC.openTerminal, input),
  openMacTerminal: (path) => ipcRenderer.invoke(IPC.openMacTerminal, path),
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
