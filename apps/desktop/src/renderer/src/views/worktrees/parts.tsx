import { ProjectIcon } from "@/components/ProjectIcon";
import type { Worktree } from "@/data/types";
import { isMerged, isOld, suggestLabel, type StaleMode, type TreeState } from "@/lib/worktreeModel";

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

interface FilterBarProps {
  mode: StaleMode;
  days: number;
  query: string;
  counts: Record<StaleMode, number>;
  onMode: (mode: StaleMode) => void;
  onDays: (days: number) => void;
  onQuery: (query: string) => void;
}

export function FilterBar({ mode, days, query, counts, onMode, onDays, onQuery }: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <div className="flex gap-1 rounded-full border border-[var(--hairline)] bg-[var(--glass-strong)] p-1" role="radiogroup" aria-label="Show">
        {MODES.map((entry) => {
          const active = mode === entry.value;
          return (
            <button
              key={entry.value}
              type="button"
              role="radio"
              aria-checked={active}
              title={entry.hint}
              onClick={() => onMode(entry.value)}
              className={`no-drag flex cursor-default items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-xs outline-none transition-colors duration-200 ${active ? "bg-[var(--accent)]/45 text-[var(--text-primary)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
            >
              {entry.label}
              <span className="text-[10px] tabular-nums opacity-70">{counts[entry.value]}</span>
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-1 rounded-full border border-[var(--hairline)] bg-[var(--glass-strong)] p-1" role="radiogroup" aria-label="Old means">
        <span className="px-2 text-[11px] text-[var(--text-muted)]">Old after</span>
        {DAY_OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={days === option}
            onClick={() => onDays(option)}
            className={`no-drag cursor-default rounded-full px-2.5 py-1 text-xs tabular-nums outline-none transition-colors duration-200 ${days === option ? "bg-white/15 text-[var(--text-primary)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
          >
            {`${option} d`}
          </button>
        ))}
      </div>
      <input
        value={query}
        onChange={(event) => onQuery(event.target.value)}
        placeholder="Search"
        spellCheck={false}
        aria-label="Search worktrees"
        className="no-drag w-40 rounded-full border border-[var(--hairline)] bg-[var(--inset)] px-3.5 py-1.5 text-xs outline-none transition-[box-shadow] duration-200 focus:shadow-[0_0_0_3px_oklch(0.62_0.24_285/0.45)]"
      />
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
