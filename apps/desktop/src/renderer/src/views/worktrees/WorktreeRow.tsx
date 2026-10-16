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

export type RowStyle = "cards" | "terminal";

export const ROW_STYLES: { value: RowStyle; label: string }[] = [
  { value: "cards", label: "Cards" },
  { value: "terminal", label: "Terminal" },
];

interface WorktreeRowProps {
  style: RowStyle;
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

const ENTER = (index: number) => ({ initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.22, delay: Math.min(index, 10) * 0.025 } });

function Badges({ tree, origin, tools, hasTwin }: Pick<WorktreeRowProps, "tree" | "origin" | "tools" | "hasTwin">) {
  return (
    <>
      <Pill tone={tree.location === "vm" ? "ok" : "neutral"}>{PLACE[tree.location]}</Pill>
      {hasTwin && <Pill>{tree.location === "mac" ? "also on VM" : "also on Mac"}</Pill>}
      {(origin.kind === "conductor" || origin.kind === "t3code" || origin.kind === "claude") && <OriginBadge origin={origin} tools={tools} />}
    </>
  );
}

function Work({ tree }: { tree: Worktree }) {
  return (
    <>
      {tree.modified > 0 && <Pill tone="warn">{`${tree.modified} modified`}</Pill>}
      {(tree.ahead > 0 || tree.behind > 0) && <Pill>{`↑${tree.ahead} ↓${tree.behind}`}</Pill>}
      {tree.sessions.length > 0 && <Pill>{`${tree.sessions.length} ${tree.sessions.length === 1 ? "session" : "sessions"}`}</Pill>}
    </>
  );
}

function CardRow(props: WorktreeRowProps) {
  const { tree, alias, size, maxSize, now, days, selected, index, onSelect, onAlias } = props;
  const state = stateOf(tree, now, days);
  const meta = STATE_META[state];
  return (
    <motion.button
      type="button"
      {...ENTER(index)}
      onClick={onSelect}
      className={`no-drag group relative flex w-full min-w-0 cursor-default flex-col overflow-hidden rounded-3xl p-px text-left outline-none transition-[box-shadow,transform] duration-300 hover:-translate-y-0.5 ${selected ? "shadow-[0_0_36px_-6px_oklch(0.62_0.24_285/0.7)]" : "hover:shadow-[0_10px_30px_-12px_rgba(0,0,0,0.7)]"}`}
      style={{ background: selected ? "linear-gradient(135deg, oklch(0.7 0.22 300), oklch(0.65 0.2 250), oklch(0.78 0.16 190))" : "linear-gradient(135deg, rgba(255,255,255,0.16), rgba(255,255,255,0.03))" }}
    >
      <span className="pointer-events-none absolute -right-12 -top-12 size-40 rounded-full opacity-35 blur-3xl transition-opacity duration-300 group-hover:opacity-65" style={{ background: meta.color }} />
      <div className="relative flex h-full flex-col gap-3 rounded-[23px] bg-[oklch(0.14_0.04_285/0.93)] p-4 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-2">
          <StateChip state={state} />
          <span className="text-[11px] tabular-nums text-[var(--text-secondary)]">{formatAge(ageDays(tree, now))}</span>
        </div>
        <div className="flex items-start gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5">
          <span aria-hidden="true" className="mt-0.5 font-mono text-sm" style={{ color: meta.color }}>⎇</span>
          <span className="line-clamp-2 [overflow-wrap:anywhere] font-mono text-[13px] leading-snug text-[var(--text-primary)]">{tree.branch ?? "detached HEAD"}</span>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className="truncate text-[13px] text-[var(--text-secondary)]">{alias ?? tree.name}</span>
          <Badges {...props} />
          <Rename tree={tree} alias={alias} onAlias={onAlias} />
        </div>
        <div className="mt-auto flex min-h-6 flex-wrap items-center gap-1.5">
          <Work tree={tree} />
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <SizeBar value={size ?? 0} max={maxSize} color={`linear-gradient(90deg, ${meta.color}, oklch(0.7 0.22 300))`} />
          </div>
          <span className="text-[11px] tabular-nums text-[var(--text-secondary)]">{typeof size === "number" ? formatBytes(size) : "…"}</span>
        </div>
      </div>
    </motion.button>
  );
}

export const TERMINAL_COLUMNS = "grid-cols-[14px_minmax(0,1.3fr)_minmax(0,1.2fr)_88px_72px_88px_64px]";

function TerminalRow(props: WorktreeRowProps) {
  const { tree, alias, size, now, days, selected, index, hasTwin, onSelect } = props;
  const state = stateOf(tree, now, days);
  const meta = STATE_META[state];
  const work = [tree.modified > 0 ? `${tree.modified}~` : "", tree.ahead > 0 ? `↑${tree.ahead}` : "", tree.behind > 0 ? `↓${tree.behind}` : ""].filter(Boolean).join(" ");
  return (
    <motion.button
      type="button"
      {...ENTER(index)}
      onClick={onSelect}
      className={`no-drag grid w-full shrink-0 cursor-default items-center gap-3 rounded-lg border px-3 py-2 text-left font-mono text-xs outline-none transition-colors duration-150 ${TERMINAL_COLUMNS} ${selected ? "border-[var(--accent)]/70 bg-[var(--accent)]/15" : "border-transparent hover:bg-white/[0.06]"}`}
    >
      <span className="size-2 rounded-full" style={{ background: meta.color, boxShadow: `0 0 8px ${meta.color}` }} />
      <span className="flex min-w-0 items-center gap-2">
        <span className="truncate text-[13px] text-[var(--text-primary)]">{alias ?? tree.name}</span>
        <span className="shrink-0 text-[10px] uppercase text-[var(--text-muted)]">{PLACE[tree.location]}</span>
        {hasTwin && <span className="shrink-0 text-[10px] text-[var(--text-muted)]">⇄</span>}
      </span>
      <span className="truncate text-[var(--text-secondary)]">{tree.branch ?? "detached"}</span>
      <span className="tabular-nums text-[var(--warn)]">{work}</span>
      <span className="text-right tabular-nums text-[var(--text-secondary)]">{typeof size === "number" ? formatBytes(size) : "…"}</span>
      <span style={{ color: meta.color }}>{meta.label.toLowerCase()}</span>
      <span className="text-right tabular-nums text-[var(--text-secondary)]">{formatAge(ageDays(tree, now))}</span>
    </motion.button>
  );
}

export function WorktreeRow(props: WorktreeRowProps) {
  if (props.style === "terminal") return <TerminalRow {...props} />;
  return <CardRow {...props} />;
}
