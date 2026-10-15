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
});

const RawStatus = z.object({
  BackendState: z.string(),
  Self: RawPeer.nullable().default(null),
  Peer: z.record(z.string(), RawPeer).default({}),
});

export function parseTailscaleStatus(raw: unknown, vmName: string, now: number): TailscaleStatus {
  const parsed = RawStatus.safeParse(raw);
  if (!parsed.success) {
    return { state: "unknown", selfName: null, vm: null, checkedAt: now };
  }
  const { BackendState, Self, Peer } = parsed.data;
  const peer = Object.values(Peer).find((candidate) => candidate.HostName === vmName);
  return {
    state: BackendState === "Running" ? "connected" : "disconnected",
    selfName: Self?.HostName ?? null,
    vm: peer
      ? {
          name: peer.HostName,
          dnsName: peer.DNSName.replace(/\.$/, ""),
          ip: peer.TailscaleIPs[0] ?? null,
          online: peer.Online,
        }
      : null,
    checkedAt: now,
  };
}

export function findTailscaleCli(): string | null {
  return TAILSCALE_CLI_CANDIDATES.find((path) => existsSync(path)) ?? null;
}

export async function getTailscaleStatus(): Promise<TailscaleStatus> {
  const cli = findTailscaleCli();
  const now = Date.now();
  if (cli === null) {
    return { state: "unknown", selfName: null, vm: null, checkedAt: now };
  }
  try {
    const { stdout } = await run(cli, ["status", "--json"], { timeout: 5000 });
    return parseTailscaleStatus(JSON.parse(stdout), VM_NAME, now);
  } catch (error) {
    console.error("tailscale status failed:", error instanceof Error ? error.message : error);
    return { state: "unknown", selfName: null, vm: null, checkedAt: now };
  }
}
