import type { ClaudeSession, Worktree } from "@/data/types";

const DAY = 86400;

export type TreeState = "active" | "idle" | "stale" | "merged" | "both";

export type StaleMode = "all" | "old" | "merged" | "either" | "both";

export type SizeMap = Record<string, number | null | undefined>;

export interface ProjectGroup {
  repo: string;
  trees: Worktree[];
  bytes: number;
  states: Record<TreeState, number>;
}

export function ageDays(tree: Pick<Worktree, "lastActive">, now: number): number {
  return tree.lastActive > 0 ? Math.max(0, Math.floor((now - tree.lastActive) / DAY)) : 0;
}

export function isOld(tree: Pick<Worktree, "lastActive" | "isMain">, now: number, days: number): boolean {
  return !tree.isMain && tree.lastActive > 0 && ageDays(tree, now) >= days;
}

const RECENT_DAYS = 3;

export function isMerged(tree: Pick<Worktree, "merged" | "upstreamGone" | "isMain" | "lastActive">, now: number): boolean {
  return !tree.isMain && (tree.merged || tree.upstreamGone) && ageDays(tree, now) >= RECENT_DAYS;
}

export function stateOf(tree: Worktree, now: number, days: number): TreeState {
  if (tree.isMain) return "active";
  const old = isOld(tree, now, days);
  const merged = isMerged(tree, now);
  if (old && merged) return "both";
  if (merged) return "merged";
  if (old) return "stale";
  return ageDays(tree, now) >= 3 ? "idle" : "active";
}

export function matchesMode(tree: Worktree, mode: StaleMode, now: number, days: number): boolean {
  const old = isOld(tree, now, days);
  const merged = isMerged(tree, now);
  switch (mode) {
    case "all":
      return true;
    case "old":
      return old;
    case "merged":
      return merged;
    case "either":
      return old || merged;
    case "both":
      return old && merged;
  }
}

export function groupByProject(trees: readonly Worktree[], sizes: SizeMap, now: number, days: number): ProjectGroup[] {
  const groups = new Map<string, ProjectGroup>();
  for (const tree of trees) {
    const group = groups.get(tree.repo) ?? { repo: tree.repo, trees: [], bytes: 0, states: { active: 0, idle: 0, stale: 0, merged: 0, both: 0 } };
    group.trees.push(tree);
    group.bytes += sizes[tree.id] ?? 0;
    group.states[stateOf(tree, now, days)] += 1;
    groups.set(tree.repo, group);
  }
  return [...groups.values()].sort((a, b) => b.bytes - a.bytes || b.trees.length - a.trees.length);
}

const GENERATED = [/^agent-[0-9a-f]{8,}$/i, /^t3-[0-9a-f]{6,}$/i, /^t3code-[0-9a-f]{6,}$/i, /^[a-z]+-[a-z]+-[0-9a-f]{5,}$/i, /^[a-z]{3,12}$/];
const BRANCH_PREFIXES = /^(?:[a-z0-9_-]+\/)*?(?:feature|feat|fix|bug|chore|docs|refactor|spec|issue|release|claude|worktree)\//i;

const ACRONYMS = new Set(["ui", "ux", "api", "i18n", "a11y", "pnld", "css", "html", "pdf", "tts", "llm", "ci", "cd", "vm", "ssh", "sdk", "cli"]);

function titleCase(text: string): string {
  const words = text.replace(/[-_]+/g, " ").trim().split(/\s+/).filter(Boolean).map((word) => (ACRONYMS.has(word.toLowerCase()) ? word.toUpperCase() : word));
  return words.map((word, index) => (index === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word)).join(" ");
}

export function looksGenerated(name: string): boolean {
  return GENERATED.some((pattern) => pattern.test(name));
}

export function suggestLabel(tree: Pick<Worktree, "name" | "branch" | "isMain">, session?: Pick<ClaudeSession, "title"> | null): { label: string; source: "branch" | "session" } | null {
  if (tree.isMain) return null;
  if (!looksGenerated(tree.name)) return null;
  const branch = tree.branch;
  if (branch !== null) {
    const stripped = branch.replace(BRANCH_PREFIXES, "").replace(/^[a-z0-9_-]+\//i, "");
    const cleaned = stripped.replace(/^[0-9]+[-_]/, "").replace(/-[0-9a-f]{6,}$/i, "");
    if (cleaned.length >= 4 && !looksGenerated(cleaned.replace(/[-_]/g, "")) && !/^(worktree-)?agent-/.test(cleaned) && cleaned !== tree.name) return { label: titleCase(cleaned), source: "branch" };
  }
  const title = session?.title.trim();
  if (title && title.length >= 8) {
    const short = title.replace(/\s+/g, " ").slice(0, 48).replace(/[\s.,:;-]+$/, "");
    return { label: short, source: "session" };
  }
  return null;
}
