import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import type { PortForwardState, VmTarget } from "@vmc/shared";
import { runLocal, sshBaseArgs } from "./ssh";

interface Forward {
  child: ChildProcess;
  localPort: number;
  state: PortForwardState;
  busyBy: string | null;
}

const FALLBACK_START = 20000;

const forwards = new Map<number, Forward>();
const failed = new Set<number>();
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

async function pickLocalPort(remote: number, taken: ReadonlySet<number>): Promise<number | null> {
  if (!taken.has(remote) && (await isLocalPortFree(remote))) return remote;
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
  const taken = new Set([...forwards.values()].map((forward) => forward.localPort));
  const local = await pickLocalPort(remote, taken);
  if (local === null) {
    failed.add(remote);
    return;
  }
  const child = spawn(
    "ssh",
    [...sshBaseArgs(target), "-N", "-o", "ExitOnForwardFailure=yes", "-L", `127.0.0.1:${local}:127.0.0.1:${remote}`],
    { stdio: "ignore" },
  );
  const forward: Forward = { child, localPort: local, state: local === remote ? "active" : "remapped", busyBy: local === remote ? null : await localOwner(remote) };
  forwards.set(remote, forward);
  failed.delete(remote);
  const release = () => {
    if (forwards.get(remote) === forward) {
      forwards.delete(remote);
      failed.add(remote);
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

export async function reconcileForwards(target: VmTarget, listening: readonly number[], autoForward: boolean): Promise<void> {
  const live = new Set(listening);
  for (const port of [...forwards.keys()]) if (!live.has(port)) stop(port);
  for (const port of [...failed, ...disabled]) if (!live.has(port)) {
    failed.delete(port);
    disabled.delete(port);
  }
  for (const [port, forward] of [...forwards]) {
    if (forward.state === "remapped" && (await isLocalPortFree(port))) {
      stop(port);
      await start(target, port);
    }
  }
  if (!autoForward) return;
  for (const port of listening) {
    if (!forwards.has(port) && !disabled.has(port) && !failed.has(port)) await start(target, port);
  }
}

export async function setForward(target: VmTarget, port: number, enabled: boolean): Promise<void> {
  if (enabled) {
    disabled.delete(port);
    failed.delete(port);
    if (!forwards.has(port)) await start(target, port);
  } else {
    disabled.add(port);
    stop(port);
  }
}

export function forwardState(port: number): { state: PortForwardState; localPort: number | null; busyBy: string | null } {
  const forward = forwards.get(port);
  if (forward) return { state: forward.state, localPort: forward.localPort, busyBy: forward.busyBy };
  return { state: failed.has(port) ? "failed" : "off", localPort: null, busyBy: null };
}

export function stopAllForwards(): void {
  for (const port of [...forwards.keys()]) stop(port);
}
