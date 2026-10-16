import { BrowserWindow } from "electron";
import { IPC, type LinkStatus } from "@vmc/shared";

let current: LinkStatus = { state: "unknown", approvalUrl: null, message: null };
const listeners = new Set<(status: LinkStatus) => void>();

export function getLinkStatus(): LinkStatus {
  return current;
}

export function onLinkChange(listener: (status: LinkStatus) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setLinkStatus(next: LinkStatus): void {
  if (next.state === current.state && next.approvalUrl === current.approvalUrl && next.message === current.message) return;
  current = next;
  for (const listener of listeners) listener(next);
  for (const window of BrowserWindow.getAllWindows()) window.webContents.send(IPC.linkChanged, next);
}

export function trayIconName(state: LinkStatus["state"]): string {
  if (state === "approval") return "trayAlertTemplate";
  if (state === "offline") return "trayOfflineTemplate";
  return "trayTemplate";
}

export function linkTooltip(status: LinkStatus): string {
  if (status.state === "approval") return "Elsewhere · Tailscale SSH needs your approval";
  if (status.state === "offline") return "Elsewhere · can't reach the VM";
  if (status.state === "ok") return "Elsewhere · VM connected";
  return "Elsewhere";
}
