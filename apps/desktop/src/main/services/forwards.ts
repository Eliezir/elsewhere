import { spawn, type ChildProcess } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";
import type { PortForwardState, VmTarget } from "@vmc/shared";
import { runLocal, sshBaseArgs } from "./ssh";

interface Forward {
  child: ChildProcess;
  target: VmTarget;
  localPort: number;
  state: PortForwardState;
  busyBy: string | null;
}

const FALLBACK_START = 20000;

const forwards = new Map<number, Forward>();
const keys = new Map<number, string>();
const pins = new Map<string, number>();
let pinsLoaded = false;
const failedAt = new Map<number, number>();
const starting = new Set<number>();
const RETRY_AFTER_MS = 10000;
const disabled = new Set<number>();

function canListen(port: number, host: string): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.once("error", (error: NodeJS.ErrnoException) => resolve(error.code === "EADDRNOTAVAIL"));
    server.listen(port, host, () => server.close(() => resolve(true)));
  });
}

export async function isLocalPortFree(port: number): Promise<boolean> {
  const checks = await Promise.all(["127.0.0.1", "::1", "0.0.0.0"].map((host) => canListen(port, host)));
  return checks.every(Boolean);
}

export function pinKeyFor(cwd: string | null, port: number): string {
  const root = cwd === null ? "unknown" : (/^(.*\/worktrees\/[^/]+\/[^/]+)/.exec(cwd)?.[1] ?? cwd);
  return `${root}|${port}`;
}

function pinsFile(): string {
  return join(process.env.VMC_HOME ?? join(homedir(), ".vm-companion"), "port-pins.json");
}

export async function loadPins(): Promise<void> {
  if (pinsLoaded) return;
  pinsLoaded = true;
  const text = await readFile(pinsFile(), "utf8").catch(() => null);
  if (text === null) return;
  try {
    for (const [key, value] of Object.entries(JSON.parse(text) as Record<string, unknown>)) {
      if (typeof value === "number" && Number.isInteger(value) && value >= 1024 && value <= 65535) pins.set(key, value);
    }
  } catch {
    return;
  }
}

async function savePins(): Promise<void> {
  await mkdir(join(pinsFile(), ".."), { recursive: true });
  await writeFile(pinsFile(), `${JSON.stringify(Object.fromEntries(pins))}\n`).catch(() => undefined);
}

export function pinnedFor(port: number): number | null {
  const key = keys.get(port);
  return key === undefined ? null : (pins.get(key) ?? null);
}

function preferredLocal(remote: number): number {
  return pinnedFor(remote) ?? remote;
}

export async function setPortPin(input: { key: string; local: number | null }): Promise<void> {
  await loadPins();
  if (input.local === null) pins.delete(input.key);
  else pins.set(input.key, input.local);
  await savePins();
  for (const [remote, key] of keys) {
    const forward = forwards.get(remote);
    if (key === input.key && forward && forward.target) {
      await restart(forward.target, remote);
    }
  }
}

async function pickLocalPort(remote: number, taken: ReadonlySet<number>): Promise<number | null> {
  const preferred = preferredLocal(remote);
  if (!taken.has(preferred) && (await isLocalPortFree(preferred))) return preferred;
  for (let candidate = FALLBACK_START + (remote % 10000); candidate < 65000; candidate += 1) {
    if (!taken.has(candidate) && (await isLocalPortFree(candidate))) return candidate;
  }
  return null;
}

export function parseOwner(lsofOutput: string, cwdOutput: string): string | null {
  const command = /^c(.+)$/m.exec(lsofOutput)?.[1];
  if (!command) return null;
  const cwd = /^n(\/.+)$/m.exec(cwdOutput)?.[1];
  const place = cwd ? cwd.split("/").filter(Boolean).slice(-1)[0] : null;
  return place ? `${command} in ${place}` : command;
}

async function localOwner(port: number): Promise<string | null> {
  if (process.platform === "win32") return null;
  const listing = await runLocal("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-Fpc"], { timeout: 5000 });
  const pid = /^p(\d+)$/m.exec(listing.stdout)?.[1];
  if (!pid) return null;
  const cwd = await runLocal("lsof", ["-a", "-p", pid, "-d", "cwd", "-Fn"], { timeout: 5000 });
  return parseOwner(listing.stdout, cwd.stdout);
}

async function start(target: VmTarget, remote: number): Promise<void> {
  if (starting.has(remote)) return;
  starting.add(remote);
  try {
    await startUnguarded(target, remote);
  } finally {
    starting.delete(remote);
  }
}

async function restart(target: VmTarget, remote: number): Promise<void> {
  if (starting.has(remote)) return;
  starting.add(remote);
  try {
    stop(remote);
    await startUnguarded(target, remote);
  } finally {
    starting.delete(remote);
  }
}

async function startUnguarded(target: VmTarget, remote: number): Promise<void> {
  const taken = new Set([...forwards.values()].map((forward) => forward.localPort));
  const local = await pickLocalPort(remote, taken);
  if (local === null) {
    failedAt.set(remote, Date.now());
    return;
  }
  const child = spawn(
    "ssh",
    [...sshBaseArgs(target), "-N", "-o", "ExitOnForwardFailure=yes", "-L", `127.0.0.1:${local}:127.0.0.1:${remote}`],
    { stdio: "ignore" },
  );
  const forward: Forward = { child, target, localPort: local, state: local === preferredLocal(remote) ? "active" : "remapped", busyBy: local === preferredLocal(remote) ? null : await localOwner(preferredLocal(remote)) };
  forwards.set(remote, forward);
  failedAt.delete(remote);
  const release = () => {
    if (forwards.get(remote) === forward) {
      forwards.delete(remote);
      failedAt.set(remote, Date.now());
    }
  };
  child.on("error", release);
  child.on("exit", release);
}

function stop(remote: number): void {
  const forward = forwards.get(remote);
  if (!forward) return;
  forwards.delete(remote);
  forward.child.kill("SIGTERM");
}

export async function reconcileForwards(target: VmTarget, listeners: readonly { port: number; key: string }[], autoForward: boolean): Promise<void> {
  await loadPins();
  const listening = listeners.map((listener) => listener.port);
  for (const listener of listeners) keys.set(listener.port, listener.key);
  const live = new Set(listening);
  for (const port of [...forwards.keys()]) if (!live.has(port)) stop(port);
  for (const port of [...failedAt.keys(), ...disabled]) if (!live.has(port)) {
    failedAt.delete(port);
    disabled.delete(port);
  }
  for (const [port, forward] of [...forwards]) {
    if (forward.state === "remapped" && (await isLocalPortFree(preferredLocal(port)))) await restart(target, port);
  }
  if (!autoForward) return;
  const now = Date.now();
  for (const port of listening) {
    const retryAt = (failedAt.get(port) ?? 0) + RETRY_AFTER_MS;
    if (!forwards.has(port) && !disabled.has(port) && now >= retryAt) await start(target, port);
  }
}

export async function setForward(target: VmTarget, port: number, enabled: boolean): Promise<void> {
  if (enabled) {
    disabled.delete(port);
    failedAt.delete(port);
    if (!forwards.has(port)) await start(target, port);
  } else {
    disabled.add(port);
    stop(port);
  }
}

export function forwardState(port: number): { state: PortForwardState; localPort: number | null; busyBy: string | null } {
  const forward = forwards.get(port);
  if (forward) return { state: forward.state, localPort: forward.localPort, busyBy: forward.busyBy };
  return { state: failedAt.has(port) ? "failed" : "off", localPort: null, busyBy: null };
}

export function stopAllForwards(): void {
  for (const port of [...forwards.keys()]) stop(port);
}

export async function stopStaleForwards(): Promise<void> {
  await runLocal("pkill", ["-f", "ExitOnForwardFailure=yes -L 127.0.0.1:"], { timeout: 5000 });
}
