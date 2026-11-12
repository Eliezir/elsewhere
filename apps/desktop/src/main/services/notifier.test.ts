import { describe, expect, it } from "vitest";
import type { AppPrefs, LinkStatus, VmPort } from "@vmc/shared";
import { createNotifier, usedPercentFromDf } from "./notifier";

const ON: AppPrefs = { startAtLogin: false, runInBackground: true, showInMenuBar: true, hideFromDock: false, notifyUnreachable: true, notifyDisk: true, notifyPorts: true, diskWarn: 80 };
const OFFLINE: LinkStatus = { state: "offline", approvalUrl: null, message: null };
const OK: LinkStatus = { state: "ok", approvalUrl: null, message: null };

function setup(prefs: AppPrefs = ON) {
  const shown: string[] = [];
  let now = 0;
  let current = prefs;
  const notifier = createNotifier({ show: (title) => void shown.push(title), now: () => now, prefs: () => current });
  return { notifier, shown, tick: (ms: number) => void (now += ms), set: (next: AppPrefs) => void (current = next) };
}

const port = (number: number, state: VmPort["state"], kind: VmPort["kind"] = "project"): VmPort => ({ port: number, process: "node", pid: 1, cwd: null, branch: null, kind, state, localPort: null, busyBy: null, pinKey: `p${number}`, pinnedLocal: null });

describe("unreachable", () => {
  it("waits for three bad checks in a row, says it once, then says it is back", () => {
    const { notifier, shown } = setup();
    notifier.handleLink(OFFLINE, "WSL PC");
    notifier.handleLink(OFFLINE, "WSL PC");
    expect(shown).toEqual([]);
    notifier.handleLink(OFFLINE, "WSL PC");
    notifier.handleLink(OFFLINE, "WSL PC");
    expect(shown).toEqual(["WSL PC isn't reachable"]);
    notifier.handleLink(OK, "WSL PC");
    expect(shown).toEqual(["WSL PC isn't reachable", "WSL PC is back"]);
  });

  it("ignores a blip that recovers before the third check", () => {
    const { notifier, shown } = setup();
    notifier.handleLink(OFFLINE, "PC");
    notifier.handleLink(OK, "PC");
    notifier.handleLink(OFFLINE, "PC");
    notifier.handleLink(OFFLINE, "PC");
    expect(shown).toEqual([]);
  });

  it("asks for approval right away and stays quiet when the setting is off", () => {
    const first = setup();
    first.notifier.handleLink({ state: "approval", approvalUrl: "https://x", message: null }, "PC");
    expect(first.shown).toEqual(["PC needs your approval"]);
    const off = setup({ ...ON, notifyUnreachable: false });
    for (let i = 0; i < 5; i += 1) off.notifier.handleLink(OFFLINE, "PC");
    expect(off.shown).toEqual([]);
  });

  it("does nothing while no host is configured", () => {
    const { notifier, shown } = setup();
    for (let i = 0; i < 5; i += 1) notifier.handleLink({ state: "unknown", approvalUrl: null, message: null }, "PC");
    expect(shown).toEqual([]);
  });
});

describe("ports", () => {
  it("tells you once per failed project port and ignores services", () => {
    const { notifier, shown } = setup();
    notifier.handlePorts([port(5173, "failed"), port(22, "failed", "service")], "PC");
    notifier.handlePorts([port(5173, "failed")], "PC");
    expect(shown).toEqual(["Port 5173 wasn't forwarded"]);
    notifier.handlePorts([port(5173, "active")], "PC");
    notifier.handlePorts([port(5173, "failed")], "PC");
    expect(shown).toHaveLength(2);
  });
});

describe("disk", () => {
  it("warns when crossing the line, then at most once a day", () => {
    const { notifier, shown, tick } = setup();
    notifier.handleDisk("This Mac", 70);
    expect(shown).toEqual([]);
    notifier.handleDisk("This Mac", 91.4);
    expect(shown).toEqual(["This Mac's disk is 91% full"]);
    tick(3 * 3600 * 1000);
    notifier.handleDisk("This Mac", 92);
    expect(shown).toHaveLength(1);
    tick(22 * 3600 * 1000);
    notifier.handleDisk("This Mac", 92);
    expect(shown).toHaveLength(2);
  });

  it("warns again after it dropped well below the line and came back", () => {
    const { notifier, shown } = setup();
    notifier.handleDisk("PC", 85);
    notifier.handleDisk("PC", 70);
    notifier.handleDisk("PC", 85);
    expect(shown).toHaveLength(2);
  });

  it("keeps each machine apart and respects the setting", () => {
    const { notifier, shown, set } = setup();
    notifier.handleDisk("A", 90);
    notifier.handleDisk("B", 90);
    expect(shown).toHaveLength(2);
    set({ ...ON, notifyDisk: false });
    notifier.handleDisk("C", 99);
    expect(shown).toHaveLength(2);
  });
});

describe("df parsing", () => {
  it("reads used percent from available space, not from the used column", () => {
    const out = "Filesystem 1024-blocks Used Available Capacity Mounted on\n/dev/disk3s5 239362496 191928244 5242880 98% /System/Volumes/Data\n";
    expect(usedPercentFromDf(out)).toBeCloseTo(97.8, 1);
    expect(usedPercentFromDf("")).toBeNull();
    expect(usedPercentFromDf("Filesystem\n")).toBeNull();
  });
});
