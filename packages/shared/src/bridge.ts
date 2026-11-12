import type { TailscaleStatus } from "./status";
import type { TailscaleControlResult } from "./status";
import type { MoveProgress, MoveRequest, MoveResult, TwinSyncInput, TwinSyncResult } from "./move";
import type { HostAppInput, HostAppResult } from "./hostApp";
import type { LanMouseInput, LanMouseStatus } from "./lanMouse";
import type { GamingInput, GamingResult } from "./pcMode";
import type { ShutdownArm, ShutdownStatus, ShutdownTarget } from "./shutdown";
import type { AppPrefs, ForwardConfig, LinkStatus, VmStorage, VmStorageInput, WakeInput, WakeResult } from "./ports";
import type { T3Threads, ToolOpenInput, ToolOpenResult, RemoteT3Input, RemoteT3Result, ToolsInfo, DeleteRequest, DeleteResult, IconChoiceResult, IconInput, ProjectIcons, PruneInput, PruneResult, SizeInput, SizeResult, VmInput, VmSnapshot, Worktree, TerminalInput } from "./worktree";

export const IPC = {
  tailscaleStatus: "tailscale:status",
  openMainWindow: "window:open-main",
  navigate: "window:navigate",
  macWorktrees: "worktrees:mac",
  vmSnapshot: "vm:snapshot",
  moveStart: "move:start",
  twinSync: "move:twin-sync",
  moveProgress: "move:progress",
  openTerminal: "vm:open-terminal",
  openMacTerminal: "terminal:open-mac",
  openTailscale: "app:open-tailscale",
  wakeHost: "host:wake",
  remoteT3Open: "tools:remote-t3-open",
  openApproval: "app:open-approval",
  projectIcons: "icons:get",
  sizes: "worktrees:sizes",
  toolsInfo: "tools:info",
  t3Threads: "tools:t3-threads",
  toolOpen: "tools:open",
  reveal: "tools:reveal",
  prunePreview: "worktrees:prune-preview",
  pruneRun: "worktrees:prune-run",
  deleteWorktree: "worktrees:delete",
  iconChoose: "icons:choose",
  iconClear: "icons:clear",
  tailscaleConnect: "tailscale:connect",
  tailscaleDisconnect: "tailscale:disconnect",
  forwardConfig: "vm:forward-config",
  appPrefs: "app:prefs",
  linkStatus: "vm:link-status",
  linkRefresh: "vm:link-refresh",
  linkChanged: "vm:link-changed",
  vmStorage: "vm:storage",
  macStorage: "storage:mac",
  shutdownStatus: "shutdown:status",
  hostApp: "host:app",
  notifyTest: "app:notify-test",
  lanMouse: "lanmouse:control",
  gamingMode: "pcmode:gaming",
  shutdownArm: "shutdown:arm",
  shutdownDisarm: "shutdown:disarm",
} as const;

export interface Api {
  platform: string;
  getTailscaleStatus(vmName?: string): Promise<TailscaleStatus>;
  getMacWorktrees(repos: string[]): Promise<Worktree[]>;
  getVmSnapshot(input: VmInput): Promise<VmSnapshot>;
  startMove(request: MoveRequest): Promise<MoveResult>;
  compareTwins(input: TwinSyncInput): Promise<TwinSyncResult>;
  onMoveProgress(listener: (progress: MoveProgress) => void): () => void;
  openVmTerminal(input: TerminalInput): Promise<string | null>;
  openMacTerminal(path: string): Promise<string | null>;
  openTailscale(): Promise<string | null>;
  wakeHost(input: WakeInput): Promise<WakeResult>;
  openInRemoteT3(input: RemoteT3Input): Promise<RemoteT3Result>;
  openApproval(url: string): Promise<boolean>;
  getProjectIcons(input: IconInput): Promise<ProjectIcons>;
  getTools(): Promise<ToolsInfo>;
  getT3Threads(paths: string[]): Promise<T3Threads>;
  openInTool(input: ToolOpenInput): Promise<ToolOpenResult>;
  revealInFinder(path: string): Promise<boolean>;
  getWorktreeSizes(input: SizeInput): Promise<SizeResult>;
  previewPrune(input: PruneInput): Promise<PruneResult>;
  runPrune(input: PruneInput): Promise<PruneResult>;
  deleteWorktree(request: DeleteRequest): Promise<DeleteResult>;
  chooseProjectIcon(repo: string): Promise<IconChoiceResult>;
  clearProjectIcon(repo: string): Promise<void>;
  connectTailscale(): Promise<TailscaleControlResult>;
  disconnectTailscale(): Promise<TailscaleControlResult>;
  setForwardConfig(input: ForwardConfig): Promise<void>;
  setAppPrefs(input: AppPrefs): Promise<void>;
  getLinkStatus(): Promise<LinkStatus>;
  refreshLinkStatus(): Promise<LinkStatus>;
  onLinkStatus(listener: (status: LinkStatus) => void): () => void;
  getVmStorage(input: VmStorageInput): Promise<VmStorage>;
  getMacStorage(): Promise<VmStorage>;
  startGamingMode(input: GamingInput): Promise<GamingResult>;
  controlLanMouse(input: LanMouseInput): Promise<LanMouseStatus>;
  sendTestNotification(): Promise<boolean>;
  controlHostApp(input: HostAppInput): Promise<HostAppResult>;
  getShutdownStatus(input: ShutdownTarget): Promise<ShutdownStatus>;
  armShutdown(input: ShutdownArm): Promise<ShutdownStatus>;
  disarmShutdown(input: ShutdownTarget): Promise<ShutdownStatus>;
  openMainWindow(section?: string): Promise<void>;
  onNavigate(listener: (section: string) => void): () => void;
}
