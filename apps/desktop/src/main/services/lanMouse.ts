import { access } from "node:fs/promises";
import type { LanMouseInput, LanMouseStatus } from "@vmc/shared";
import { runLocal } from "./ssh";

export const LAN_MOUSE_BIN = "/Applications/Lan Mouse.app/Contents/MacOS/lan-mouse";

export interface ClientState {
  id: number;
  active: boolean;
}

export function parseClients(output: string): ClientState[] {
  return output.split("\n").flatMap((line) => {
    const match = /^id (\d+):.*active: (true|false)/.exec(line.trim());
    return match?.[1] && match[2] ? [{ id: Number(match[1]), active: match[2] === "true" }] : [];
  });
}

export interface Exec {
  (args: string[]): Promise<{ ok: boolean; stdout: string; stderr: string }>;
}

export interface Timers {
  now: () => number;
  set: (callback: () => void, ms: number) => unknown;
  clear: (handle: unknown) => void;
}

const REAL_TIMERS: Timers = { now: () => Date.now(), set: (callback, ms) => setTimeout(callback, ms), clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>) };

export function createLanMouse(exec: Exec, timers: Timers = REAL_TIMERS) {
  let handle: unknown = null;
  let backAt: number | null = null;

  const cancelTimer = () => {
    if (handle !== null) timers.clear(handle);
    handle = null;
    backAt = null;
  };

  const status = async (): Promise<LanMouseStatus> => {
    const listed = await exec(["cli", "list"]);
    if (!listed.ok) return { running: false, active: false, clients: 0, backAt: null, error: null };
    const clients = parseClients(listed.stdout);
    return { running: true, active: clients.some((client) => client.active), clients: clients.length, backAt, error: null };
  };

  const setAll = async (active: boolean): Promise<string | null> => {
    const listed = await exec(["cli", "list"]);
    if (!listed.ok) return "Lan Mouse isn't running on this Mac.";
    for (const client of parseClients(listed.stdout)) {
      const result = await exec(["cli", active ? "activate" : "deactivate", String(client.id)]);
      if (!result.ok) return "Lan Mouse didn't accept the change.";
    }
    return null;
  };

  const stop = async (): Promise<LanMouseStatus> => {
    cancelTimer();
    const error = await setAll(false);
    return { ...(await status()), error };
  };

  const control = async (input: LanMouseInput): Promise<LanMouseStatus> => {
    if (input.action === "status") return status();
    if (input.action === "stop") return stop();
    cancelTimer();
    const error = await setAll(true);
    if (error) return { ...(await status()), error };
    if (input.minutes) {
      backAt = timers.now() + input.minutes * 60000;
      handle = timers.set(() => {
        handle = null;
        backAt = null;
        void setAll(false);
      }, input.minutes * 60000);
    }
    return status();
  };

  return { control };
}

async function realExec(args: string[]) {
  const present = await access(LAN_MOUSE_BIN).then(() => true, () => false);
  if (!present) return { ok: false, stdout: "", stderr: "not installed" };
  const result = await runLocal(LAN_MOUSE_BIN, args, { timeout: 8000 });
  return { ok: result.code === 0, stdout: result.stdout, stderr: result.stderr };
}

export const lanMouse = createLanMouse(realExec);
