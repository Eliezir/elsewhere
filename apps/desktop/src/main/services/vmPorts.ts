import type { VmPorts, VmTarget } from "@vmc/shared";
import { forwardState, reconcileForwards } from "./forwards";
import { describeSshFailure, runSsh } from "./ssh";

export interface Listener {
  port: number;
  process: string;
  pid: number | null;
  cwd: string | null;
}

const IGNORED_PORTS = new Set([22]);

export const PORTS_SCRIPT = `
ss -ltnpH 2>/dev/null
echo "@@CWDS"
for pid in $(ss -ltnpH 2>/dev/null | grep -o 'pid=[0-9]*' | cut -d= -f2 | sort -u); do
  echo "$pid $(readlink /proc/$pid/cwd 2>/dev/null)"
done
`;

function portOf(address: string): number | null {
  const match = /:(\d+)$/.exec(address);
  return match?.[1] ? Number(match[1]) : null;
}

export function parseListeners(output: string): Listener[] {
  const [ssPart = "", cwdPart = ""] = output.split("@@CWDS");
  const cwds = new Map<number, string>();
  for (const line of cwdPart.split("\n")) {
    const match = /^(\d+) (\/.*)$/.exec(line.trim());
    if (match?.[1] && match[2]) cwds.set(Number(match[1]), match[2]);
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
    if (!found.has(port)) found.set(port, { port, process: users[1], pid, cwd: cwds.get(pid) ?? null });
  }
  return [...found.values()].sort((a, b) => a.port - b.port);
}

export async function getVmPorts(target: VmTarget, autoForward: boolean): Promise<VmPorts> {
  const result = await runSsh(target, PORTS_SCRIPT, { timeout: 20000 });
  if (result.code !== 0) return { reachable: false, error: describeSshFailure(result), ports: [] };
  const listeners = parseListeners(result.stdout);
  await reconcileForwards(target, listeners.map((listener) => listener.port), autoForward);
  return { reachable: true, error: null, ports: listeners.map((listener) => ({ ...listener, ...forwardState(listener.port) })) };
}
