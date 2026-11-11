import type { VmStorage } from "@vmc/shared";
import { parseStorage } from "./vmStorage";
import { runLocal } from "./ssh";

export const MAC_STORAGE_SCRIPT = `
H="$HOME"
D=/System/Volumes/Data
[ -d "$D" ] || D=/
df -kP "$D" 2>/dev/null | awk 'NR==2{print "@@DISK",$2,$3,$4}'
du -sk -x "$H/conductor" "$H/.claude" "$H/Developer" "$H/Library/Caches" "$H/Library/Developer" "$H/Library/pnpm" "$H/Downloads" "$H/Documents" "$H/Desktop" "$H/.Trash" "$H/.npm" "$H/.cache" 2>/dev/null | sed 's/^/@@H /'
du -sk -x "$H/Library/Application Support"/* 2>/dev/null | sort -rn | head -6 | sed 's/^/@@H /'
du -sk -x "$H/.t3"/* 2>/dev/null | sort -rn | head -5 | sed 's/^/@@H /'
`;

export async function getMacStorage(): Promise<VmStorage> {
  const result = await runLocal("sh", ["-c", MAC_STORAGE_SCRIPT], { timeout: 240000 });
  if (result.code !== 0 && result.stdout.trim() === "") {
    return { reachable: false, error: result.stderr.trim().split("\n").pop() || "Couldn't measure this Mac's folders.", diskUsedBytes: 0, diskTotalBytes: 0, entries: [] };
  }
  return { reachable: true, error: null, ...parseStorage(result.stdout) };
}
