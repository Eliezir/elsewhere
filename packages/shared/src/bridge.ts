import type { TailscaleStatus } from "./status";
import type { TailscaleControlResult } from "./status";
import type { MoveProgress, MoveRequest, MoveResult, TwinSyncInput, TwinSyncResult } from "./move";
import type { UsageSnapshot } from "./usage";
import type { VmTarget } from "./worktree";
import type { ForwardConfig, KillPortInput, KillPortResult, PortForwardToggle, VmPorts, VmPortsInput, VmStorage, VmStorageInput } from "./ports";
import type { ClaudeDesktopOpenResult, T3Threads, ToolOpenInput, ToolOpenResult, ToolsInfo, DeleteRequest, DeleteResult, IconChoiceResult, IconInput, ProjectIcons, PruneInput, PruneResult, SizeInput, SizeResult, VmInput, VmSnapshot, Worktree, TerminalInput } from "./worktree";

export const IPC = {
  tailscaleStatus: "tailscale:status",
  openMainWindow: "window:open-main",
  navigate: "window:navigate",
  usage: "usage:get",
  usageRefresh: "usage:refresh",
  macWorktrees: "worktrees:mac",
  vmSnapshot: "vm:snapshot",
  moveStart: "move:start",
  twinSync: "move:twin-sync",
  moveProgress: "move:progress",
  openTerminal: "vm:open-terminal",
  openMacTerminal: "terminal:open-mac",
  openTailscale: "app:open-tailscale",
  openApproval: "app:open-approval",
  projectIcons: "icons:get",
  sizes: "worktrees:sizes",
  toolsInfo: "tools:info",
  claudeDesktopOpen: "tools:claude-desktop-open",
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
  vmPorts: "vm:ports",
  vmPortForward: "vm:port-forward",
  vmPortKill: "vm:port-kill",
  forwardConfig: "vm:forward-config",
  openLocalPort: "app:open-local-port",
  vmStorage: "vm:storage",
} as const;

export interface Api {
  platform: string;
  getTailscaleStatus(): Promise<TailscaleStatus>;
  getUsage(): Promise<UsageSnapshot>;
  refreshUsage(): Promise<UsageSnapshot>;
  getMacWorktrees(repos: string[]): Promise<Worktree[]>;
  getVmSnapshot(input: VmInput): Promise<VmSnapshot>;
  startMove(request: MoveRequest): Promise<MoveResult>;
  compareTwins(input: TwinSyncInput): Promise<TwinSyncResult>;
  onMoveProgress(listener: (progress: MoveProgress) => void): () => void;
  openVmTerminal(input: TerminalInput): Promise<string | null>;
  openMacTerminal(path: string): Promise<string | null>;
  openTailscale(): Promise<string | null>;
  openApproval(url: string): Promise<boolean>;
  getProjectIcons(input: IconInput): Promise<ProjectIcons>;
  getTools(): Promise<ToolsInfo>;
  getT3Threads(paths: string[]): Promise<T3Threads>;
  openInClaudeDesktop(input: { target: VmTarget; path: string; sessionId?: string | undefined }): Promise<ClaudeDesktopOpenResult>;
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
  getVmPorts(input: VmPortsInput): Promise<VmPorts>;
  setPortForward(input: PortForwardToggle): Promise<VmPorts>;
  killVmPort(input: KillPortInput): Promise<KillPortResult>;
  setForwardConfig(input: ForwardConfig): Promise<void>;
  openLocalPort(port: number): Promise<boolean>;
  getVmStorage(input: VmStorageInput): Promise<VmStorage>;
  openMainWindow(section?: string): Promise<void>;
  onNavigate(listener: (section: string) => void): () => void;
}
