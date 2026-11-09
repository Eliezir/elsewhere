import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildArmScript, parseShutdownStatus, WATCHER_SCRIPT } from "./shutdown";

const homes: string[] = [];

function fakeHome(): string {
  const home = mkdtempSync(join(tmpdir(), "vmc-shutdown-"));
  homes.push(home);
  mkdirSync(join(home, ".claude", "projects", "p"), { recursive: true });
  return home;
}

function runWatcher(home: string, idle: number, grace: number) {
  writeFileSync(join(home, "watch.sh"), WATCHER_SCRIPT);
  const child = spawn("sh", [join(home, "watch.sh"), String(idle), String(grace)], {
    env: { ...process.env, HOME: home, VMC_POLL: "1", VMC_BUSY_PATTERN: "no-such-process-xyz", VMC_SHUTDOWN_CMD: `touch "${home}/fired"` },
    detached: true,
    stdio: "ignore",
  });
  return () => {
    if (child.pid) {
      try {
        process.kill(-child.pid);
      } catch {
        return;
      }
    }
  };
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

afterEach(() => {
  while (homes.length > 0) rmSync(homes.pop() as string, { recursive: true, force: true });
});

describe("shutdown watcher", () => {
  it("fires the shutdown command once nothing has been written for the idle window", async () => {
    const home = fakeHome();
    const transcript = join(home, ".claude", "projects", "p", "a.jsonl");
    writeFileSync(transcript, "{}");
    const old = new Date(Date.now() - 3600 * 1000);
    utimesSync(transcript, old, old);
    const stop = runWatcher(home, 5, 1);
    try {
      await wait(1500);
      expect(existsSync(join(home, "fired"))).toBe(false);
    } finally {
      stop();
    }
    const stop0 = runWatcher(home, 0, 1);
    try {
      for (let i = 0; i < 20 && !existsSync(join(home, "fired")); i += 1) await wait(500);
      expect(existsSync(join(home, "fired"))).toBe(true);
    } finally {
      stop0();
    }
  }, 20000);

  it("stays quiet while an agent transcript was written inside the window", async () => {
    const home = fakeHome();
    writeFileSync(join(home, ".claude", "projects", "p", "live.jsonl"), "{}");
    const stop = runWatcher(home, 5, 1);
    try {
      await wait(4000);
      expect(existsSync(join(home, "fired"))).toBe(false);
    } finally {
      stop();
    }
  }, 15000);
});

describe("shutdown scripts and status", () => {
  it("embeds the watcher and the numbers in the arm script", () => {
    const script = buildArmScript({ idleMinutes: 15, graceSeconds: 120 });
    expect(script).toContain("<<'VMC_WATCHER'");
    expect(script).toContain('watch.sh" 15 120');
    expect(script).toContain("@@ALIVE");
  });

  it("rejects numbers that are not finite", () => {
    expect(() => buildArmScript({ idleMinutes: Number.NaN, graceSeconds: 120 })).toThrow();
  });

  it("reads off, watching and counting-down states", () => {
    expect(parseShutdownStatus("@@NOW 1000\n@@ALIVE 0\n").state).toBe("off");
    const watching = parseShutdownStatus("@@NOW 1000\n@@ALIVE 1\nstate=watching\nidle_since=400\nidle_min=15\ngrace=120\nends=0\n");
    expect(watching).toMatchObject({ state: "watching", idleMinutes: 15, graceSeconds: 120, idleForMinutes: 10, secondsLeft: null });
    const counting = parseShutdownStatus("@@NOW 1000\n@@ALIVE 1\nstate=counting-down\nidle_since=100\nidle_min=15\ngrace=120\nends=1090\n");
    expect(counting).toMatchObject({ state: "counting-down", secondsLeft: 90 });
  });

  it("treats a busy watcher as zero idle minutes", () => {
    const busy = parseShutdownStatus("@@NOW 1000\n@@ALIVE 1\nstate=watching\nidle_since=0\nidle_min=15\ngrace=120\nends=0\n");
    expect(busy.idleForMinutes).toBe(0);
  });
});
