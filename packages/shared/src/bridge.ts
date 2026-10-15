import type { TailscaleStatus } from "./status";
import type { TailscaleControlResult } from "./status";
import type { MoveProgress, MoveRequest, MoveResult } from "./move";
import type { UsageSnapshot } from "./usage";
import type { T3Threads, ToolOpenInput, ToolOpenResult, ToolsInfo, DeleteRequest, DeleteResult, IconChoiceResult, IconInput, ProjectIcons, PruneInput, PruneResult, SizeInput, SizeResult, VmInput, VmSnapshot, Worktree, TerminalInput } from "./worktree";

export const IPC = {
  tailscaleStatus: "tailscale:status",
  openMainWindow: "window:open-main",
  navigate: "window:navigate",
  usage: "usage:get",
  usageRefresh: "usage:refresh",
  macWorktrees: "worktrees:mac",
  vmSnapshot: "vm:snapshot",
  moveStart: "move:start",
  moveProgress: "move:progress",
  openTerminal: "vm:open-terminal",
  openMacTerminal: "terminal:open-mac",
  openTailscale: "app:open-tailscale",
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
} as const;

export interface Api {
  getTailscaleStatus(): Promise<TailscaleStatus>;
  getUsage(): Promise<UsageSnapshot>;
  refreshUsage(): Promise<UsageSnapshot>;
  getMacWorktrees(repos: string[]): Promise<Worktree[]>;
  getVmSnapshot(input: VmInput): Promise<VmSnapshot>;
  startMove(request: MoveRequest): Promise<MoveResult>;
  onMoveProgress(listener: (progress: MoveProgress) => void): () => void;
  openVmTerminal(input: TerminalInput): Promise<string | null>;
  openMacTerminal(path: string): Promise<string | null>;
  openTailscale(): Promise<string | null>;
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
  openMainWindow(section?: string): Promise<void>;
  onNavigate(listener: (section: string) => void): () => void;
}
