import type { AppPrefs, LinkStatus, VmPort } from "@vmc/shared";

export type NotifySection = "overview" | "storage" | "settings";

export interface NotifierDeps {
  show: (title: string, body: string, section: NotifySection) => void;
  now: () => number;
  prefs: () => AppPrefs;
}

const OFFLINE_TICKS = 3;
const DISK_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const DISK_RESET_MARGIN = 3;

export function createNotifier(deps: NotifierDeps) {
  let offlineTicks = 0;
  let linkAlerted = false;
  let failedPorts = new Set<string>();
  const disks = new Map<string, { above: boolean; at: number }>();

  return {
    handleLink(status: LinkStatus, host: string): void {
      const prefs = deps.prefs();
      if (status.state === "ok") {
        if (linkAlerted && prefs.notifyUnreachable) deps.show(`${host} is back`, "The connection is working again.", "overview");
        offlineTicks = 0;
        linkAlerted = false;
        return;
      }
      if (status.state === "unknown") return;
      offlineTicks += 1;
      const approval = status.state === "approval";
      if (linkAlerted || offlineTicks < (approval ? 1 : OFFLINE_TICKS) || !prefs.notifyUnreachable) return;
      linkAlerted = true;
      deps.show(approval ? `${host} needs your approval` : `${host} isn't reachable`, status.message ?? (approval ? "Tailscale SSH needs your approval." : "Check that it's on and that Tailscale is connected."), "overview");
    },

    handlePorts(ports: readonly VmPort[], host: string): void {
      const prefs = deps.prefs();
      const failed = ports.filter((port) => port.kind === "project" && port.state === "failed");
      if (prefs.notifyPorts) {
        for (const port of failed) {
          if (!failedPorts.has(port.pinKey)) deps.show(`Port ${port.port} wasn't forwarded`, `${host} is serving something on ${port.port}, but this Mac couldn't open it.`, "overview");
        }
      }
      failedPorts = new Set(failed.map((port) => port.pinKey));
    },

    handleDisk(label: string, usedPercent: number): void {
      const prefs = deps.prefs();
      const state = disks.get(label) ?? { above: false, at: 0 };
      if (usedPercent < prefs.diskWarn - DISK_RESET_MARGIN) {
        disks.set(label, { above: false, at: state.at });
        return;
      }
      if (usedPercent < prefs.diskWarn) return;
      if (state.above && deps.now() - state.at < DISK_COOLDOWN_MS) return;
      disks.set(label, { above: true, at: deps.now() });
      if (prefs.notifyDisk) deps.show(`${label}'s disk is ${Math.round(usedPercent)}% full`, "Free some space before it runs out.", "storage");
    },
  };
}

export function usedPercentFromDf(output: string): number | null {
  const line = output.split("\n").find((row, index) => index > 0 && row.trim() !== "");
  if (!line) return null;
  const columns = line.trim().split(/\s+/);
  const total = Number(columns[1]);
  const available = Number(columns[3]);
  if (!Number.isFinite(total) || !Number.isFinite(available) || total <= 0) return null;
  return ((total - available) / total) * 100;
}
