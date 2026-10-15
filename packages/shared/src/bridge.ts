import type { TailscaleStatus } from "./status";

export const IPC = {
  tailscaleStatus: "tailscale:status",
  openMainWindow: "window:open-main",
  navigate: "window:navigate",
} as const;

export interface Api {
  getTailscaleStatus(): Promise<TailscaleStatus>;
  openMainWindow(section?: string): Promise<void>;
  onNavigate(listener: (section: string) => void): () => void;
}
