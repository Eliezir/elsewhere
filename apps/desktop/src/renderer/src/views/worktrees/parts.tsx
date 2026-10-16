import { Popover } from "@base-ui/react/popover";
import { AnimatePresence, motion } from "motion/react";
import { ProjectIcon } from "@/components/ProjectIcon";
import type { Worktree } from "@/data/types";
import { isMerged, isOld, suggestLabel, type SortKey, type StaleMode, type TreeState } from "@/lib/worktreeModel";

export const STATE_META: Record<TreeState, { label: string; color: string; soft: string }> = {
  active: { label: "Active", color: "oklch(0.78 0.16 165)", soft: "oklch(0.78 0.16 165 / 0.16)" },
  idle: { label: "Idle", color: "oklch(0.68 0.05 290)", soft: "oklch(0.68 0.05 290 / 0.14)" },
  stale: { label: "Old", color: "oklch(0.82 0.14 80)", soft: "oklch(0.82 0.14 80 / 0.16)" },
  merged: { label: "Merged", color: "oklch(0.74 0.15 250)", soft: "oklch(0.74 0.15 250 / 0.16)" },
  both: { label: "Old and merged", color: "oklch(0.7 0.19 25)", soft: "oklch(0.7 0.19 25 / 0.16)" },
};

export const MODES: { value: StaleMode; label: string; hint: string }[] = [
  { value: "all", label: "All", hint: "Every worktree" },
  { value: "old", label: "Old", hint: "No activity for the chosen number of days" },
  { value: "merged", label: "Merged", hint: "Branch already merged or its remote is gone" },
  { value: "either", label: "Old or merged", hint: "Either one" },
  { value: "both", label: "Old and merged", hint: "Both: the safest to delete" },
];

export const DAY_OPTIONS = [7, 14, 30, 60, 90];

export function formatAge(days: number): string {
  if (days < 1) return "today";
  if (days < 14) return `${days} d`;
  if (days < 90) return `${Math.round(days / 7)} wk`;
  if (days < 730) return `${Math.round(days / 30)} mo`;
  return `${Math.round(days / 365)} yr`;
}

export function StateChip({ state }: { state: TreeState }) {
  const meta = STATE_META[state];
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px]" style={{ background: meta.soft, color: meta.color }}>
      <span className="size-1.5 rounded-full" style={{ background: meta.color }} />
      {meta.label}
    </span>
  );
}

export function SizeBar({ value, max, color }: { value: number; max: number; color: string }) {
  const percent = max <= 0 ? 0 : Math.max(2, Math.min(100, (value / max) * 100));
  return (
    <div className="h-1 overflow-hidden rounded-full bg-white/10">
      <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${percent}%`, background: color }} />
    </div>
  );
}

export function StateBar({ states }: { states: Record<TreeState, number> }) {
  const total = Object.values(states).reduce((sum, value) => sum + value, 0);
  if (total === 0) return <div className="h-1.5 rounded-full bg-white/10" />;
  const order: TreeState[] = ["active", "idle", "merged", "stale", "both"];
  return (
    <div className="flex h-1.5 gap-px overflow-hidden rounded-full bg-white/10">
      {order.map((state) =>
        states[state] > 0 ? <div key={state} title={`${STATE_META[state].label}: ${states[state]}`} className="h-full transition-[flex-grow] duration-500" style={{ flexGrow: states[state], background: STATE_META[state].color }} /> : null,
      )}
    </div>
  );
}

export function ProjectMark({ repo, icon, size = "md" }: { repo: string; icon: string | null | undefined; size?: "sm" | "md" | "lg" }) {
  return <ProjectIcon repo={repo} icon={icon ?? null} size={size} />;
}

interface RenameProps {
  tree: Worktree;
  alias: string | undefined;
  onAlias: (label: string | null) => void;
}

export function Rename({ tree, alias, onAlias }: RenameProps) {
  const suggestion = suggestLabel(tree, tree.sessions[0] ?? null);
  if (alias) {
    return (
      <span
        role="button"
        tabIndex={0}
        onClick={(event) => {
          event.stopPropagation();
          onAlias(null);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") onAlias(null);
        }}
        title={`The folder is still named ${tree.name}. Click to go back to it.`}
        className="no-drag cursor-default rounded-full bg-[var(--inset)] px-2 py-0.5 text-[11px] text-[var(--text-secondary)] outline-none transition-colors duration-200 hover:text-[var(--text-primary)]"
      >
        {`was ${tree.name} · undo`}
      </span>
    );
  }
  if (!suggestion) return null;
  return (
    <span
      role="button"
      tabIndex={0}
      onClick={(event) => {
        event.stopPropagation();
        onAlias(suggestion.label);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") onAlias(suggestion.label);
      }}
      title={`Suggested from the ${suggestion.source === "branch" ? "branch name" : "first conversation"}. Only changes the name shown here, never the folder.`}
      className="no-drag flex max-w-full cursor-default items-center gap-1.5 truncate rounded-full border border-dashed border-[var(--hairline)] px-2 py-0.5 text-[11px] text-[var(--accent)] outline-none transition-colors duration-200 hover:bg-[var(--accent)]/15"
    >
      <span aria-hidden="true">✦</span>
      <span className="truncate">{`Name it “${suggestion.label}”`}</span>
    </span>
  );
}

export const SORTS: { value: SortKey; label: string; hint: string }[] = [
  { value: "recent", label: "Last active", hint: "Most recent work first" },
  { value: "oldest", label: "Oldest first", hint: "Longest untouched first" },
  { value: "cleanup", label: "Cleanup priority", hint: "Old and merged first, biggest first" },
  { value: "size", label: "Size", hint: "Largest on disk first" },
  { value: "changes", label: "Uncommitted work", hint: "Most modified files and unpushed commits first" },
  { value: "name", label: "Name", hint: "A to Z" },
];

const STALE_RULES = MODES.filter((entry) => entry.value !== "all");

const POPUP = "z-50 rounded-2xl border border-[var(--hairline)] bg-[oklch(0.15_0.05_285)] p-2 shadow-2xl outline-none transition-[opacity,transform] duration-150 data-[ending-style]:scale-95 data-[starting-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0";

const TRIGGER = "no-drag flex cursor-default items-center gap-1.5 whitespace-nowrap rounded-full border border-[var(--hairline)] bg-[var(--glass-strong)] px-3 py-1.5 text-xs outline-none transition-colors duration-200 hover:bg-white/10 data-[popup-open]:bg-white/10";

function Option({ active, label, hint, onClick }: { active: boolean; label: string; hint?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={`no-drag flex w-full cursor-default items-center gap-2.5 rounded-xl px-2.5 py-2 text-left outline-none transition-colors duration-150 ${active ? "bg-[var(--accent)]/30" : "hover:bg-white/8"}`}
    >
      <span className={`flex size-3.5 shrink-0 items-center justify-center rounded-full border transition-colors duration-150 ${active ? "border-[var(--accent)]" : "border-white/25"}`}>
        <span className={`size-1.5 rounded-full bg-[var(--accent)] transition-transform duration-150 ${active ? "scale-100" : "scale-0"}`} />
      </span>
      <span className="min-w-0">
        <span className="block text-xs">{label}</span>
        {hint && <span className="block text-[11px] leading-snug text-[var(--text-muted)]">{hint}</span>}
      </span>
    </button>
  );
}

interface FilterBarProps {
  mode: StaleMode;
  days: number;
  query: string;
  sort: SortKey;
  counts: Record<StaleMode, number>;
  onMode: (mode: StaleMode) => void;
  onDays: (days: number) => void;
  onQuery: (query: string) => void;
  onSort: (sort: SortKey) => void;
}

export function FilterBar({ mode, days, query, sort, counts, onMode, onDays, onQuery, onSort }: FilterBarProps) {
  const staleOn = mode !== "all";
  const rule = STALE_RULES.find((entry) => entry.value === mode);
  const sortLabel = SORTS.find((entry) => entry.value === sort)?.label ?? "";
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <div className="flex gap-1 rounded-full border border-[var(--hairline)] bg-[var(--glass-strong)] p-1" role="radiogroup" aria-label="Show">
        <button type="button" role="radio" aria-checked={!staleOn} onClick={() => onMode("all")} className={`no-drag flex cursor-default items-center gap-1.5 rounded-full px-3 py-1 text-xs outline-none transition-colors duration-200 ${!staleOn ? "bg-[var(--accent)]/45" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}>
          All
          <span className="text-[10px] tabular-nums opacity-70">{counts.all}</span>
        </button>
        <button type="button" role="radio" aria-checked={staleOn} onClick={() => onMode(staleOn ? mode : "either")} className={`no-drag flex cursor-default items-center gap-1.5 rounded-full px-3 py-1 text-xs outline-none transition-colors duration-200 ${staleOn ? "bg-[var(--accent)]/45" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}>
          Stale
          <span className="text-[10px] tabular-nums opacity-70">{counts[staleOn ? mode : "either"]}</span>
        </button>
      </div>
      <AnimatePresence initial={false}>
        {staleOn && (
          <motion.div initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -6 }} transition={{ duration: 0.18 }}>
            <Popover.Root>
              <Popover.Trigger className={TRIGGER} aria-label="What counts as stale">
                <span className="text-[var(--text-muted)]">Stale means</span>
                <span>{`${rule?.label ?? ""} · ${days} d`}</span>
                <span aria-hidden="true" className="text-[10px] text-[var(--text-muted)]">▾</span>
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Positioner sideOffset={8} align="start" className="z-50">
                  <Popover.Popup className={`${POPUP} w-72`}>
                    <div className="px-2.5 pb-1 pt-1.5 text-[11px] uppercase tracking-wider text-[var(--text-muted)]">Count a worktree when it is</div>
                    <div role="radiogroup" aria-label="Stale rule">
                      {STALE_RULES.map((entry) => (
                        <Option key={entry.value} active={mode === entry.value} label={`${entry.label} (${counts[entry.value]})`} hint={entry.hint} onClick={() => onMode(entry.value)} />
                      ))}
                    </div>
                    <div className="mx-2.5 my-2 h-px bg-[var(--hairline)]" />
                    <div className="px-2.5 pb-1.5 text-[11px] uppercase tracking-wider text-[var(--text-muted)]">Old after</div>
                    <div className="flex gap-1 px-1.5 pb-1" role="radiogroup" aria-label="Old after">
                      {DAY_OPTIONS.map((option) => (
                        <button key={option} type="button" role="radio" aria-checked={days === option} onClick={() => onDays(option)} className={`no-drag flex-1 cursor-default rounded-full py-1 text-xs tabular-nums outline-none transition-colors duration-200 ${days === option ? "bg-[var(--accent)]/45" : "bg-white/5 text-[var(--text-secondary)] hover:bg-white/10"}`}>
                          {`${option} d`}
                        </button>
                      ))}
                    </div>
                  </Popover.Popup>
                </Popover.Positioner>
              </Popover.Portal>
            </Popover.Root>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="ml-auto flex items-center gap-2.5">
        <Popover.Root>
          <Popover.Trigger className={TRIGGER} aria-label="Sort worktrees">
            <span aria-hidden="true" className="text-[var(--text-muted)]">⇅</span>
            <span className="text-[var(--text-muted)]">Sort</span>
            <span>{sortLabel}</span>
            <span aria-hidden="true" className="text-[10px] text-[var(--text-muted)]">▾</span>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner sideOffset={8} align="end" className="z-50">
              <Popover.Popup className={`${POPUP} w-64`}>
                <div role="radiogroup" aria-label="Sort by">
                  {SORTS.map((entry) => (
                    <Option key={entry.value} active={sort === entry.value} label={entry.label} hint={entry.hint} onClick={() => onSort(entry.value)} />
                  ))}
                </div>
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
        <input
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="Search"
          spellCheck={false}
          aria-label="Search worktrees"
          className="no-drag w-40 rounded-full border border-[var(--hairline)] bg-[var(--inset)] px-3.5 py-1.5 text-xs outline-none transition-[box-shadow] duration-200 focus:shadow-[0_0_0_3px_oklch(0.62_0.24_285/0.45)]"
        />
      </div>
    </div>
  );
}

export function modeCounts(trees: readonly Worktree[], now: number, days: number): Record<StaleMode, number> {
  const counts: Record<StaleMode, number> = { all: 0, old: 0, merged: 0, either: 0, both: 0 };
  for (const tree of trees) {
    const old = isOld(tree, now, days);
    const merged = isMerged(tree, now);
    counts.all += 1;
    if (old) counts.old += 1;
    if (merged) counts.merged += 1;
    if (old || merged) counts.either += 1;
    if (old && merged) counts.both += 1;
  }
  return counts;
}
