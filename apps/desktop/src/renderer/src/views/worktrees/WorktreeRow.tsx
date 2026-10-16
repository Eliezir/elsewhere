import { motion } from "motion/react";
import type { ToolsInfo } from "@vmc/shared";
import { OriginBadge } from "@/components/OriginBadge";
import { Pill } from "@/components/Tile";
import type { Worktree } from "@/data/types";
import { formatBytes } from "@/lib/format";
import type { Origin } from "@/lib/origin";
import { PLACE } from "@/lib/worktrees";
import { ageDays, stateOf } from "@/lib/worktreeModel";
import { formatAge, Rename, SizeBar, StateChip, STATE_META } from "./parts";

interface WorktreeRowProps {
  tree: Worktree;
  alias: string | undefined;
  size: number | null | undefined;
  maxSize: number;
  now: number;
  days: number;
  origin: Origin;
  tools: ToolsInfo | undefined;
  selected: boolean;
  index: number;
  hasTwin: boolean;
  onSelect: () => void;
  onAlias: (label: string | null) => void;
}

export function WorktreeRow({ tree, alias, size, maxSize, now, days, origin, tools, selected, index, hasTwin, onSelect, onAlias }: WorktreeRowProps) {
  const state = stateOf(tree, now, days);
  const meta = STATE_META[state];
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: Math.min(index, 10) * 0.02 }}
      onClick={onSelect}
      className={`no-drag relative grid w-full shrink-0 cursor-default grid-cols-[1fr_auto] items-center gap-4 overflow-hidden rounded-2xl border py-3 pl-5 pr-4 text-left outline-none transition-colors duration-200 ${selected ? "border-[var(--accent)] bg-[var(--accent)]/15" : "border-[var(--hairline)] bg-[var(--inset)] hover:bg-white/5"}`}
    >
      <span className="absolute inset-y-0 left-0 w-1" style={{ background: meta.color }} />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-[15px]">{alias ?? tree.name}</span>
          <Pill tone={tree.location === "vm" ? "ok" : "neutral"}>{PLACE[tree.location]}</Pill>
          {hasTwin && <Pill>{tree.location === "mac" ? "also on VM" : "also on Mac"}</Pill>}
          {(origin.kind === "conductor" || origin.kind === "t3code" || origin.kind === "claude") && <OriginBadge origin={origin} tools={tools} />}
          <Rename tree={tree} alias={alias} onAlias={onAlias} />
        </div>
        <div className="mt-0.5 truncate text-xs text-[var(--text-secondary)]">{tree.branch ?? "detached HEAD"}</div>
      </div>
      <div className="flex shrink-0 items-center gap-4">
        {tree.modified > 0 && <Pill tone="warn">{`${tree.modified} modified`}</Pill>}
        {(tree.ahead > 0 || tree.behind > 0) && <Pill>{`↑${tree.ahead} ↓${tree.behind}`}</Pill>}
        {tree.sessions.length > 0 && <Pill>{`${tree.sessions.length} ${tree.sessions.length === 1 ? "session" : "sessions"}`}</Pill>}
        <div className="w-20">
          <div className="mb-1 text-[11px] tabular-nums text-[var(--text-secondary)]">{typeof size === "number" ? formatBytes(size) : "…"}</div>
          <SizeBar value={size ?? 0} max={maxSize} color="var(--accent)" />
        </div>
        <div className="w-32 text-right">
          <StateChip state={state} />
          <div className="mt-1 text-[11px] tabular-nums text-[var(--text-secondary)]">{formatAge(ageDays(tree, now))}</div>
        </div>
      </div>
    </motion.button>
  );
}
