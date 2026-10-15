import type { Worktree } from "@/data/types";

const DAY = 86400;
const RECENT_DAYS = 3;

export interface StaleInfo {
  stale: boolean;
  reasons: string[];
}

export function staleInfo(tree: Pick<Worktree, "lastActive" | "merged" | "upstreamGone" | "isMain">, staleDays: number, nowSeconds = Math.floor(Date.now() / 1000)): StaleInfo {
  if (tree.isMain) return { stale: false, reasons: [] };
  const idleDays = tree.lastActive > 0 ? Math.floor((nowSeconds - tree.lastActive) / DAY) : 0;
  const reasons: string[] = [];
  if (tree.lastActive > 0 && idleDays >= staleDays) reasons.push(`No activity for ${idleDays} days`);
  if (idleDays >= RECENT_DAYS && tree.merged) reasons.push("Its branch is already merged");
  if (idleDays >= RECENT_DAYS && tree.upstreamGone) reasons.push("Its remote branch was deleted");
  return { stale: reasons.length > 0, reasons };
}
