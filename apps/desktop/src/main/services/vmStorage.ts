import type { StorageEntry, VmStorage, VmTarget } from "@vmc/shared";
import { describeSshFailure, runSsh } from "./ssh";

export const STORAGE_SCRIPT = `
H="$HOME"
df -kP / 2>/dev/null | awk 'NR==2{print "@@DISK",$2,$3}'
du -sk -x "$H"/* "$H"/.[!.]* 2>/dev/null | sed 's/^/@@H /'
du -sk -x "$H"/Developer/worktrees/*/* 2>/dev/null | sed 's/^/@@W /'
du -sk -x "$H"/Developer/.vmc/* 2>/dev/null | sed 's/^/@@V /'
`;

const KINDS = { "@@H": "home", "@@W": "worktree", "@@V": "hub" } as const;

export function parseStorage(output: string): Omit<VmStorage, "reachable" | "error"> {
  let diskUsedBytes = 0;
  let diskTotalBytes = 0;
  const entries: StorageEntry[] = [];
  for (const line of output.split("\n")) {
    const disk = /^@@DISK (\d+) (\d+)/.exec(line);
    if (disk?.[1] && disk[2]) {
      diskTotalBytes = Number(disk[1]) * 1024;
      diskUsedBytes = Number(disk[2]) * 1024;
      continue;
    }
    const row = /^(@@[HWV]) (\d+)\s+(\/.+)$/.exec(line);
    if (!row?.[1] || !row[2] || !row[3]) continue;
    const kind = KINDS[row[1] as keyof typeof KINDS];
    entries.push({ path: row[3], bytes: Number(row[2]) * 1024, kind });
  }
  return { diskUsedBytes, diskTotalBytes, entries: entries.sort((a, b) => b.bytes - a.bytes) };
}

export async function getVmStorage(target: VmTarget): Promise<VmStorage> {
  const result = await runSsh(target, STORAGE_SCRIPT, { timeout: 180000 });
  if (result.code !== 0) return { reachable: false, error: describeSshFailure(result), diskUsedBytes: 0, diskTotalBytes: 0, entries: [] };
  return { reachable: true, error: null, ...parseStorage(result.stdout) };
}
