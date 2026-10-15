import type { TwinSyncInput, TwinSyncResult } from "@vmc/shared";
import { localGit } from "./flow";
import { sshRemote, type Remote } from "./remote";

export function parseCounts(output: string): { macOnly: number; vmOnly: number } | null {
  const [left, right] = output.trim().split(/\s+/);
  const macOnly = Number(left);
  const vmOnly = Number(right);
  return Number.isInteger(macOnly) && Number.isInteger(vmOnly) ? { macOnly, vmOnly } : null;
}

export async function compareTwins(input: TwinSyncInput, remote: Remote = sshRemote(input.target)): Promise<TwinSyncResult> {
  const ref = `refs/vmc/from-vm/${input.branch}`;
  try {
    await localGit(input.macPath, ["fetch", "-q", remote.url(input.vmPath), `+${input.branch}:${ref}`], remote.gitEnv);
    const counts = parseCounts(await localGit(input.macPath, ["rev-list", "--left-right", "--count", `HEAD...${ref}`]));
    if (counts === null) return { ok: false, macOnly: 0, vmOnly: 0, error: "Couldn't compare the two copies." };
    return { ok: true, ...counts, error: null };
  } catch (error) {
    return { ok: false, macOnly: 0, vmOnly: 0, error: error instanceof Error ? error.message : "Couldn't compare the two copies." };
  }
}
