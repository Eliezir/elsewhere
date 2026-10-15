import type { VmSnapshot, VmTarget } from "@vmc/shared";
import { describeSshFailure, runSsh } from "./ssh";
import { parseSnapshot, snapshotScript } from "./vmSnapshot";

const SAMPLE_EVERY_MS = 5 * 60 * 1000;
const MAX_SAMPLES = 144;

const samples: { at: number; cpu: number }[] = [];

function remember(cpu: number, now: number): number[] {
  const last = samples[samples.length - 1];
  if (!last || now - last.at >= SAMPLE_EVERY_MS) {
    samples.push({ at: now, cpu });
    if (samples.length > MAX_SAMPLES) samples.shift();
  }
  return samples.map((sample) => sample.cpu);
}

export async function getVmSnapshot(target: VmTarget, repos: readonly string[]): Promise<VmSnapshot> {
  const started = Date.now();
  const result = await runSsh(target, snapshotScript(repos), { timeout: 45000 });
  if (result.code !== 0) {
    return { reachable: false, error: describeSshFailure(result), latencyMs: null, health: null, worktrees: [] };
  }
  const { health, worktrees } = parseSnapshot(result.stdout);
  return {
    reachable: true,
    error: null,
    latencyMs: Date.now() - started,
    health: health ? { ...health, loadSeries: remember(health.cpu, Date.now()) } : null,
    worktrees,
  };
}
