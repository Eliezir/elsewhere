import type { TailscaleStatus } from "./status";
import type { UsageSnapshot } from "./usage";

export const IPC = {
  tailscaleStatus: "tailscale:status",
  openMainWindow: "window:open-main",
  navigate: "window:navigate",
  usage: "usage:get",
  usageRefresh: "usage:refresh",
} as const;

export interface Api {
  getTailscaleStatus(): Promise<TailscaleStatus>;
  getUsage(): Promise<UsageSnapshot>;
  refreshUsage(): Promise<UsageSnapshot>;
  openMainWindow(section?: string): Promise<void>;
  onNavigate(listener: (section: string) => void): () => void;
}
