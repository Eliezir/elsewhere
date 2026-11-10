import { describe, expect, it } from "vitest";
import { BUSY_SCRIPT, LAUNCH_SCRIPT, parseBusy, startGamingMode, STOP_JOB, type GamingDeps } from "./pcMode";

const target = { host: "pc", user: "dev" };

function deps(reasons: string[], reachable = true) {
  const calls: string[] = [];
  const value: GamingDeps = {
    checkBusy: async () => ({ reachable, reasons, error: reachable ? null : "no route" }),
    stopSharing: async () => void calls.push("stopSharing"),
    closeLanMouse: async () => void calls.push("closeLanMouse"),
    launch: async () => {
      calls.push("launch");
      return true;
    },
  };
  return { value, calls };
}

describe("gaming mode", () => {
  it("reads every busy reason", () => {
    expect(parseBusy("@@BUSY an agent wrote\n@@BUSY a build or test is running\n@@DONE\n")).toEqual(["an agent wrote", "a build or test is running"]);
    expect(parseBusy("@@DONE")).toEqual([]);
  });

  it("stops sharing, closes Lan Mouse, then stops WSL, in that order", async () => {
    const { value, calls } = deps([]);
    expect((await startGamingMode(target, false, value)).ok).toBe(true);
    expect(calls).toEqual(["stopSharing", "closeLanMouse", "launch"]);
  });

  it("refuses and changes nothing while something is running", async () => {
    const { value, calls } = deps(["a build or test is running"]);
    const result = await startGamingMode(target, false, value);
    expect(result).toMatchObject({ ok: false, busy: true, reason: "a build or test is running" });
    expect(calls).toEqual([]);
  });

  it("goes ahead when forced", async () => {
    const { value, calls } = deps(["an agent wrote"]);
    expect((await startGamingMode(target, true, value)).ok).toBe(true);
    expect(calls).toContain("launch");
  });

  it("reports an unreachable host without touching anything", async () => {
    const { value, calls } = deps([], false);
    expect(await startGamingMode(target, false, value)).toMatchObject({ ok: false, error: "no route" });
    expect(calls).toEqual([]);
  });

  it("leaves Docker's WSL alone and shuts everything down only when nothing else runs", () => {
    expect(STOP_JOB).toContain("docker-desktop");
    expect(STOP_JOB).toContain("--shutdown");
    expect(STOP_JOB).toContain("--terminate");
    expect(LAUNCH_SCRIPT).toContain("setsid nohup");
    expect(LAUNCH_SCRIPT).toContain("@@STARTED");
    expect(BUSY_SCRIPT).toContain("@@DONE");
  });
});
