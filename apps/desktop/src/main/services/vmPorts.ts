import type { KillPortResult, VmPorts, VmTarget } from "@vmc/shared";
import { forwardState, reconcileForwards } from "./forwards";
import { describeSshFailure, runSsh } from "./ssh";

export interface Listener {
  port: number;
  process: string;
  pid: number | null;
  cwd: string | null;
  branch: string | null;
  kind: "project" | "service";
}

const IGNORED_PORTS = new Set([22]);

export const PORTS_SCRIPT = `
ss -ltnpH 2>/dev/null
pids=$(ss -ltnpH 2>/dev/null | grep -o 'pid=[0-9]*' | cut -d= -f2 | sort -u)
echo "@@CWDS"
for pid in $pids; do
  echo "$pid $(readlink /proc/$pid/cwd 2>/dev/null)"
done
echo "@@BRANCHES"
for pid in $pids; do
  cwd=$(readlink /proc/$pid/cwd 2>/dev/null)
  [ -n "$cwd" ] || continue
  b=$(git -C "$cwd" rev-parse --abbrev-ref HEAD 2>/dev/null)
  [ -n "$b" ] && echo "$pid $b"
done
exit 0
`;

function portOf(address: string): number | null {
  const match = /:(\d+)$/.exec(address);
  return match?.[1] ? Number(match[1]) : null;
}

export function parseListeners(output: string): Listener[] {
  const [ssPart = "", rest = ""] = output.split("@@CWDS");
  const [cwdPart = "", branchPart = ""] = rest.split("@@BRANCHES");
  const cwds = new Map<number, string>();
  for (const line of cwdPart.split("\n")) {
    const match = /^(\d+) (\/.*)$/.exec(line.trim());
    if (match?.[1] && match[2]) cwds.set(Number(match[1]), match[2]);
  }
  const branches = new Map<number, string>();
  for (const line of branchPart.split("\n")) {
    const match = /^(\d+) (\S+)$/.exec(line.trim());
    if (match?.[1] && match[2]) branches.set(Number(match[1]), match[2] === "HEAD" ? "detached" : match[2]);
  }
  const found = new Map<number, Listener>();
  for (const line of ssPart.split("\n")) {
    const columns = line.trim().split(/\s+/);
    if (columns[0] !== "LISTEN" || columns.length < 5) continue;
    const port = portOf(columns[3] ?? "");
    if (port === null || IGNORED_PORTS.has(port)) continue;
    const users = /\(\("([^"]+)",pid=(\d+)/.exec(line);
    if (!users?.[1]) continue;
    const pid = Number(users[2]);
    const branch = branches.get(pid) ?? null;
    if (!found.has(port)) found.set(port, { port, process: users[1], pid, cwd: cwds.get(pid) ?? null, branch, kind: branch === null ? "service" : "project" });
  }
  return [...found.values()].sort((a, b) => a.port - b.port);
}

export async function getVmPorts(target: VmTarget, autoForward: boolean): Promise<VmPorts> {
  const result = await runSsh(target, PORTS_SCRIPT, { timeout: 20000 });
  if (result.code !== 0) return { reachable: false, error: describeSshFailure(result), ports: [] };
  const listeners = parseListeners(result.stdout);
  await reconcileForwards(target, listeners.filter((listener) => listener.kind === "project").map((listener) => listener.port), autoForward);
  return { reachable: true, error: null, ports: listeners.map((listener) => ({ ...listener, ...forwardState(listener.port) })) };
}

export function pickKillable(listeners: readonly Listener[], port: number): { pid: number } | { error: string } {
  const listener = listeners.find((item) => item.port === port);
  if (!listener) return { error: "Nothing is listening on that port any more." };
  if (listener.kind !== "project" || listener.pid === null) return { error: "That is a system service, not a project server. Elsewhere won't stop it." };
  return { pid: listener.pid };
}

export async function killVmPort(target: VmTarget, port: number, force: boolean): Promise<KillPortResult> {
  const listing = await runSsh(target, PORTS_SCRIPT, { timeout: 20000 });
  if (listing.code !== 0) return { ok: false, message: describeSshFailure(listing) };
  const picked = pickKillable(parseListeners(listing.stdout), port);
  if ("error" in picked) return { ok: false, message: picked.error };
  const result = await runSsh(target, `kill -${force ? "KILL" : "TERM"} ${picked.pid}`, { timeout: 15000 });
  return result.code === 0 ? { ok: true, message: null } : { ok: false, message: describeSshFailure(result) };
}
