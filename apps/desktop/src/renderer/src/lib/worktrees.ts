import type { Location, Worktree } from "@/data/types";

export const PLACE: Record<Location, string> = { mac: "Mac", vm: "VM" };

export function counterpartOf(tree: Worktree, all: readonly Worktree[]): Worktree | null {
  if (tree.branch === null) return null;
  return all.find((other) => other.location !== tree.location && other.repo === tree.repo && other.branch === tree.branch) ?? null;
}
