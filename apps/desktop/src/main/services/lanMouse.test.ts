import { describe, expect, it } from "vitest";
import { createLanMouse, parseClients, type Exec, type Timers } from "./lanMouse";

function fake(initial: boolean) {
  let active = initial;
  const calls: string[] = [];
  const exec: Exec = async (args) => {
    calls.push(args.join(" "));
    if (args[1] === "list") return { ok: true, stdout: `id 0: 192.168.0.36:4242 (right) active: ${active}, ips: {192.168.0.36}\n`, stderr: "" };
    active = args[1] === "activate";
    return { ok: true, stdout: "", stderr: "" };
  };
  return { exec, calls, isActive: () => active };
}

function clock() {
  let now = 1000;
  const pending: { run: () => void; at: number; cancelled: boolean }[] = [];
  const timers: Timers = {
    now: () => now,
    set: (callback, ms) => {
      const entry = { run: callback, at: now + ms, cancelled: false };
      pending.push(entry);
      return entry;
    },
    clear: (handle) => {
      (handle as { cancelled: boolean }).cancelled = true;
    },
  };
  return { timers, advance: (ms: number) => { now += ms; pending.filter((e) => !e.cancelled && e.at <= now).forEach((e) => { e.cancelled = true; e.run(); }); } };
}

describe("lan mouse control", () => {
  it("reads the client list", () => {
    expect(parseClients("id 0: 192.168.0.36:4242 (right) active: true, ips: {192.168.0.36}\nid 3: pc (left) active: false, ips: {}")).toEqual([
      { id: 0, active: true },
      { id: 3, active: false },
    ]);
    expect(parseClients("")).toEqual([]);
  });

  it("turns sharing on and off", async () => {
    const { exec, calls, isActive } = fake(false);
    const controller = createLanMouse(exec);
    expect((await controller.control({ action: "share" })).active).toBe(true);
    expect(isActive()).toBe(true);
    expect((await controller.control({ action: "stop" })).active).toBe(false);
    expect(calls).toContain("cli activate 0");
    expect(calls).toContain("cli deactivate 0");
  });

  it("comes back by itself after the time limit and reports when", async () => {
    const { exec, isActive } = fake(false);
    const time = clock();
    const controller = createLanMouse(exec, time.timers);
    const shared = await controller.control({ action: "share", minutes: 15 });
    expect(shared.backAt).toBe(1000 + 15 * 60000);
    time.advance(14 * 60000);
    expect(isActive()).toBe(true);
    time.advance(60000);
    await Promise.resolve();
    await Promise.resolve();
    expect(isActive()).toBe(false);
  });

  it("cancels the timer when stopped by hand", async () => {
    const { exec, isActive } = fake(false);
    const time = clock();
    const controller = createLanMouse(exec, time.timers);
    await controller.control({ action: "share", minutes: 5 });
    await controller.control({ action: "stop" });
    await controller.control({ action: "share" });
    time.advance(10 * 60000);
    await Promise.resolve();
    expect(isActive()).toBe(true);
  });

  it("says so when Lan Mouse isn't running", async () => {
    const exec: Exec = async () => ({ ok: false, stdout: "", stderr: "refused" });
    const controller = createLanMouse(exec);
    expect((await controller.control({ action: "status" })).running).toBe(false);
    expect((await controller.control({ action: "share" })).error).toMatch(/isn't running/);
  });
});
