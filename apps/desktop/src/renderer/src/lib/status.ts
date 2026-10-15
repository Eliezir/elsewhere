import type { TailscaleStatus } from "@vmc/shared";

export type Health = "ok" | "warn" | "down" | "unknown";

export function healthOf(status: TailscaleStatus | undefined): Health {
  if (status === undefined || status.state === "unknown") return "unknown";
  if (status.state === "disconnected") return "down";
  if (status.vm === null) return "warn";
  return status.vm.online ? "ok" : "down";
}

export function describe(status: TailscaleStatus | undefined): string {
  if (status === undefined) return "Checking…";
  if (status.backend === "NotInstalled") return "Tailscale isn't installed";
  if (status.state === "unknown") return "Tailscale isn't running";
  if (status.backend === "NeedsLogin") return "Sign in to Tailscale";
  if (status.state === "disconnected") return "Tailscale is disconnected";
  if (status.vm === null) return "VM not found on your tailnet";
  return status.vm.online ? `Tailscale connected · ${status.vm.ip ?? "no IP"}` : "VM is offline";
}
