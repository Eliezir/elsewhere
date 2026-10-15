import type { Worktree } from "@/data/types";

export type OriginKind = "conductor" | "t3code" | "claude" | "main" | "manual" | "vm";

export interface Origin {
  kind: OriginKind;
  label: string;
  detail: string | null;
}

const LAST_SEGMENT = /([^/]+)\/?$/;

function lastSegment(path: string): string {
  return LAST_SEGMENT.exec(path)?.[1] ?? path;
}

export function originOf(tree: Pick<Worktree, "path" | "location" | "isMain" | "name">, hasT3Thread = false): Origin {
  if (tree.location === "vm") return { kind: "vm", label: "The VM", detail: tree.path.includes("/.vmc/") || tree.path.includes("/worktrees/") ? "moved with Elsewhere" : null };
  if (tree.path.includes("/conductor/workspaces/")) return { kind: "conductor", label: "Conductor", detail: `workspace ${lastSegment(tree.path)}` };
  if (tree.path.includes("/.t3/worktrees/") || hasT3Thread) return { kind: "t3code", label: "T3 Code", detail: hasT3Thread ? "has a thread" : null };
  if (tree.path.includes("/.claude/worktrees/")) return { kind: "claude", label: "Claude Code agent", detail: null };
  if (tree.isMain) return { kind: "main", label: "Main checkout", detail: null };
  return { kind: "manual", label: "Created manually", detail: null };
}

export function toolFor(origin: Origin): "conductor" | "t3code" | null {
  return origin.kind === "conductor" || origin.kind === "t3code" ? origin.kind : null;
}
