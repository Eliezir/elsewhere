import type { TailscaleStatus } from "./status";
import type { TailscaleControlResult } from "./status";
import type { MoveProgress, MoveRequest, MoveResult } from "./move";
import type { UsageSnapshot } from "./usage";
import type { IconInput, VmInput, VmSnapshot, Worktree, TerminalInput } from "./worktree";

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
  openTailscale: "app:open-tailscale",
  openApproval: "app:open-approval",
  projectIcons: "icons:get",
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
  openTailscale(): Promise<string | null>;
  openApproval(url: string): Promise<boolean>;
  getProjectIcons(input: IconInput): Promise<Record<string, string | null>>;
  connectTailscale(): Promise<TailscaleControlResult>;
  disconnectTailscale(): Promise<TailscaleControlResult>;
  openMainWindow(section?: string): Promise<void>;
  onNavigate(listener: (section: string) => void): () => void;
}
