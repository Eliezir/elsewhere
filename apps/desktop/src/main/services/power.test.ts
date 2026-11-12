import { describe, expect, it } from "vitest";
import { launchScript, powerAction, powerJob, type PowerDeps } from "./power";

const target = { host: "pc", user: "u" };

function deps(reasons: string[], reachable = true) {
  const calls: string[] = [];
  const value: PowerDeps = {
    checkBusy: async () => ({ reachable, reasons, error: reachable ? null : "no route" }),
    stopSharing: async () => void calls.push("stopSharing"),
    launch: async (_target, action) => {
      calls.push(`launch:${action}`);
      return true;
    },
  };
  return { value, calls };
}

describe("power actions", () => {
  it("builds the right Windows command for each action", () => {
    expect(powerJob("sleep")).toContain("SetSuspendState");
    expect(powerJob("shutdown")).toContain("shutdown.exe /s /t 30");
    expect(powerJob("restart")).toContain("shutdown.exe /r /t 30");
    expect(powerJob("shutdown")).toContain("shutdown /a");
    expect(launchScript("sleep")).toContain("setsid nohup");
    expect(launchScript("sleep")).toContain("@@STARTED");
  });

  it("stops keyboard sharing first, then launches", async () => {
    const { value, calls } = deps([]);
    expect((await powerAction(target, "sleep", false, value)).ok).toBe(true);
    expect(calls).toEqual(["stopSharing", "launch:sleep"]);
  });

  it("refuses while an agent or build runs, and goes ahead when forced", async () => {
    const refused = deps(["a build or test is running"]);
    expect(await powerAction(target, "shutdown", false, refused.value)).toMatchObject({ ok: false, busy: true, reason: "a build or test is running" });
    expect(refused.calls).toEqual([]);
    const forced = deps(["a build or test is running"]);
    expect((await powerAction(target, "restart", true, forced.value)).ok).toBe(true);
    expect(forced.calls).toEqual(["stopSharing", "launch:restart"]);
  });

  it("reports an unreachable host without touching anything", async () => {
    const { value, calls } = deps([], false);
    expect(await powerAction(target, "sleep", false, value)).toMatchObject({ ok: false, error: "no route" });
    expect(calls).toEqual([]);
  });
});
