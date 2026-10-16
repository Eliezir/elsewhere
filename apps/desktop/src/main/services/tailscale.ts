import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { promisify } from "node:util";
import { z } from "zod";
import type { TailscaleStatus } from "@vmc/shared";
import { TAILSCALE_CLI_CANDIDATES, VM_NAME } from "../config";

const run = promisify(execFile);

const RawPeer = z.object({
  HostName: z.string(),
  DNSName: z.string().default(""),
  TailscaleIPs: z.array(z.string()).default([]),
  Online: z.boolean().default(false),
  OS: z.string().default(""),
});

const RawStatus = z.object({
  BackendState: z.string(),
  Self: RawPeer.nullable().default(null),
  Peer: z.record(z.string(), RawPeer).default({}),
  CurrentTailnet: z.object({ Name: z.string().default("") }).nullable().default(null),
});

const EMPTY: Omit<TailscaleStatus, "checkedAt"> = { state: "unknown", backend: "Unknown", selfName: null, selfIp: null, tailnet: null, vm: null, peers: [] };

export function parseTailscaleStatus(raw: unknown, vmName: string, now: number): TailscaleStatus {
  const parsed = RawStatus.safeParse(raw);
  if (!parsed.success) {
    return { ...EMPTY, checkedAt: now };
  }
  const { BackendState, Self, Peer, CurrentTailnet } = parsed.data;
  const peers = Object.values(Peer)
    .map((peer) => ({
      name: peer.HostName,
      dnsName: peer.DNSName.replace(/\.$/, ""),
      ip: peer.TailscaleIPs[0] ?? null,
      online: peer.Online,
      os: peer.OS === "" ? null : peer.OS,
      isVm: peer.HostName === vmName,
    }))
    .sort((a, b) => Number(b.isVm) - Number(a.isVm) || Number(b.online) - Number(a.online) || a.name.localeCompare(b.name));
  const vm = peers.find((peer) => peer.isVm);
  return {
    state: BackendState === "Running" ? "connected" : "disconnected",
    backend: BackendState,
    selfName: Self?.HostName ?? null,
    selfIp: Self?.TailscaleIPs[0] ?? null,
    tailnet: CurrentTailnet?.Name === "" ? null : (CurrentTailnet?.Name ?? null),
    vm: vm ? { name: vm.name, dnsName: vm.dnsName, ip: vm.ip, online: vm.online } : null,
    peers,
    checkedAt: now,
  };
}

export function findTailscaleCli(): string | null {
  return TAILSCALE_CLI_CANDIDATES.find((path) => existsSync(path)) ?? null;
}

const GRACE_MS = 60_000;
const RETRY_MS = 1200;
const SETTLED_BACKENDS = new Set(["Running", "NeedsLogin", "Stopped"]);

let lastConnected: TailscaleStatus | null = null;

export function settleStatus(fresh: TailscaleStatus, lastGood: TailscaleStatus | null, now: number): TailscaleStatus {
  if (fresh.state === "connected" || lastGood === null || now - lastGood.checkedAt > GRACE_MS) return fresh;
  if (fresh.state === "unknown" || !SETTLED_BACKENDS.has(fresh.backend)) return { ...lastGood, checkedAt: now };
  return fresh;
}

async function readStatus(cli: string): Promise<TailscaleStatus> {
  const now = Date.now();
  try {
    const { stdout } = await run(cli, ["status", "--json"], { timeout: 10000 });
    return parseTailscaleStatus(JSON.parse(stdout), VM_NAME, now);
  } catch (error) {
    console.error("tailscale status failed:", error instanceof Error ? error.message : error);
    return { ...EMPTY, backend: "NotRunning", checkedAt: now };
  }
}

export async function getTailscaleStatus(): Promise<TailscaleStatus> {
  const cli = findTailscaleCli();
  if (cli === null) return { ...EMPTY, backend: "NotInstalled", checkedAt: Date.now() };
  let fresh = await readStatus(cli);
  if (fresh.state !== "connected" && !SETTLED_BACKENDS.has(fresh.backend)) {
    await new Promise((resolve) => setTimeout(resolve, RETRY_MS));
    fresh = await readStatus(cli);
  }
  const settled = settleStatus(fresh, lastConnected, Date.now());
  if (settled.state === "connected") lastConnected = settled;
  return settled;
}
