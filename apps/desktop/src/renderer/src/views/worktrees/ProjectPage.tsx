import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { T3Threads, ToolsInfo } from "@vmc/shared";
import { Segmented } from "@/components/controls";
import { Button } from "@/components/controls";
import type { Location, VmSnapshot, Worktree } from "@/data/types";
import { formatBytes } from "@/lib/format";
import type { Origin } from "@/lib/origin";
import { useSettings } from "@/lib/settings";
import { staleInfo } from "@/lib/stale";
import { counterpartOf } from "@/lib/worktrees";
import { matchesMode, sortTrees, type SizeMap, type SortKey, type StaleMode } from "@/lib/worktreeModel";
import { FilterBar, modeCounts, ProjectMark } from "./parts";
import { WorktreeDetail } from "./WorktreeDetail";
import { ROW_STYLES, TERMINAL_COLUMNS, WorktreeRow, type RowStyle } from "./WorktreeRow";

type Place = "all" | Location;

const PLACES = [
  { value: "all", label: "All" },
  { value: "mac", label: "Mac" },
  { value: "vm", label: "VM" },
] as const;

const STYLE_KEY = "vmc:row-style";

function storedStyle(): RowStyle {
  try {
    const value = window.localStorage.getItem(STYLE_KEY);
    return ROW_STYLES.some((entry) => entry.value === value) ? (value as RowStyle) : "cards";
  } catch {
    return "cards";
  }
}

const HEADERS: { label: string; sort?: SortKey; right?: boolean }[] = [
  { label: "" },
  { label: "name", sort: "name" },
  { label: "branch" },
  { label: "work", sort: "changes" },
  { label: "size", sort: "size", right: true },
  { label: "state", sort: "cleanup" },
  { label: "age", sort: "recent", right: true },
];

function TerminalHeader({ sort, onSort }: { sort: SortKey; onSort: (sort: SortKey) => void }) {
  return (
    <div className={`sticky top-0 z-10 grid shrink-0 gap-3 border-b border-[var(--hairline)] bg-[oklch(0.13_0.04_285/0.9)] px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-[var(--text-muted)] backdrop-blur ${TERMINAL_COLUMNS}`}>
      {HEADERS.map((header, index) => {
        const target = header.label === "age" && sort === "recent" ? "oldest" : header.sort;
        const active = header.sort !== undefined && (sort === header.sort || (header.label === "age" && sort === "oldest"));
        return header.sort ? (
          <button key={index} type="button" onClick={() => target && onSort(target)} className={`no-drag cursor-default uppercase outline-none transition-colors duration-150 hover:text-[var(--text-primary)] ${header.right ? "text-right" : "text-left"} ${active ? "text-[var(--text-primary)]" : ""}`}>
            {header.label}
            {active && " ↓"}
          </button>
        ) : (
          <span key={index} className={header.right ? "text-right" : ""}>{header.label}</span>
        );
      })}
    </div>
  );
}

interface ProjectPageProps {
  repo: string;
  trees: Worktree[];
  all: readonly Worktree[];
  icons: Record<string, { icon: string | null; custom: boolean } | undefined>;
  tools: ToolsInfo | undefined;
  t3Threads: T3Threads;
  originFor: (tree: Worktree) => Origin;
  sizes: SizeMap;
  vm: VmSnapshot | undefined;
  now: number;
  names: Record<string, string>;
  problem: ReactNode;
  onAlias: (path: string, label: string | null) => void;
  onBack: () => void;
  onChanged: () => void;
  onCleanup: (trees: Worktree[]) => void;
}

export function ProjectPage({ repo, trees, all, icons, tools, t3Threads, originFor, sizes, vm, now, names, problem, onAlias, onBack, onChanged, onCleanup }: ProjectPageProps) {
  const [settings, update] = useSettings();
  const [mode, setMode] = useState<StaleMode>("all");
  const [place, setPlace] = useState<Place>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const [rowStyle, setRowStyle] = useState<RowStyle>(storedStyle);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const days = settings.staleDays;
  const chooseStyle = (next: RowStyle) => {
    setRowStyle(next);
    try {
      window.localStorage.setItem(STYLE_KEY, next);
    } catch {
      return;
    }
  };

  useEffect(() => {
    if (selectedId !== null && !trees.some((tree) => tree.id === selectedId)) setSelectedId(null);
  }, [selectedId, trees]);

  const needle = query.trim().toLowerCase();
  const filtered = trees.filter((tree) => {
    if (place !== "all" && tree.location !== place) return false;
    if (!matchesMode(tree, mode, now, days)) return false;
    return needle === "" || `${tree.name} ${names[tree.path] ?? ""} ${tree.branch ?? ""}`.toLowerCase().includes(needle);
  });
  const shown = useMemo(() => sortTrees(filtered, sort, sizes, names, now, days), [filtered, sort, sizes, names, now, days]);
  const selected = shown.find((tree) => tree.id === selectedId) ?? shown[0] ?? null;
  const selectedTwin = selected ? counterpartOf(selected, all) : null;
  const counts = modeCounts(trees, now, days);
  const stale = shown.filter((tree) => staleInfo(tree, days).stale);
  const staleBytes = stale.reduce((sum, tree) => sum + (sizes[tree.id] ?? 0), 0);
  const pending = trees.filter((tree) => sizes[tree.id] == null).length;
  const bytes = trees.reduce((sum, tree) => sum + (sizes[tree.id] ?? 0), 0);
  const max = Math.max(1, ...shown.map((tree) => sizes[tree.id] ?? 0));

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <button type="button" onClick={onBack} className="no-drag flex cursor-default items-center gap-1.5 rounded-full border border-[var(--hairline)] bg-white/5 px-3.5 py-1.5 text-sm outline-none transition-colors duration-200 hover:bg-white/10">
            <span aria-hidden="true">‹</span>
            Projects
          </button>
          <ProjectMark repo={repo} icon={icons[repo]?.icon} size="lg" />
          <div>
            <div className="text-xl font-medium tracking-tight">{repo}</div>
            <div className="text-xs text-[var(--text-secondary)]">{`${trees.length} worktrees · ${pending === trees.length ? "…" : `${formatBytes(bytes)}${pending > 0 ? "+" : ""}`}`}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Segmented id="worktree-place" label="Location" options={PLACES} value={place} onChange={setPlace} />
          <Button variant="primary" disabled={stale.length === 0} onClick={() => onCleanup(stale)} className="!px-4 !py-1.5 text-xs">
            {stale.length === 0 ? "Nothing to clean" : pending > 0 ? `Clean up ${stale.length}` : `Clean up ${stale.length} · ${formatBytes(staleBytes)}`}
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <FilterBar mode={mode} days={days} query={query} sort={sort} counts={counts} onMode={setMode} onDays={(staleDays) => update({ staleDays })} onQuery={setQuery} onSort={setSort} />
        </div>
        <Segmented id="worktree-view" label="View" options={ROW_STYLES} value={rowStyle} onChange={chooseStyle} />
      </div>
      {problem}
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_400px] gap-3">
        <div className={`min-h-0 overflow-y-auto pr-1 ${rowStyle === "cards" ? "grid auto-rows-min grid-cols-2 content-start gap-3" : `flex flex-col ${rowStyle === "terminal" ? "gap-0.5" : "gap-2.5"}`}`}>
          {rowStyle === "terminal" && shown.length > 0 && <TerminalHeader sort={sort} onSort={setSort} />}
          {shown.map((tree, index) => (
            <WorktreeRow
              key={tree.id}
              style={rowStyle}
              tree={tree}
              alias={names[tree.path]}
              size={sizes[tree.id]}
              maxSize={max}
              now={now}
              days={days}
              origin={originFor(tree)}
              tools={tools}
              selected={tree.id === selected?.id}
              index={index}
              hasTwin={counterpartOf(tree, all) !== null}
              onSelect={() => setSelectedId(tree.id)}
              onAlias={(label) => onAlias(tree.path, label)}
            />
          ))}
          {shown.length === 0 && <p className="rounded-2xl border border-dashed border-[var(--hairline)] p-8 text-center text-xs text-[var(--text-muted)]">{trees.length === 0 ? "No worktrees found." : "Nothing matches this filter."}</p>}
        </div>
        <WorktreeDetail
          selected={selected}
          twin={selectedTwin}
          worktrees={all}
          icons={icons}
          tools={tools}
          t3Threads={t3Threads}
          originFor={originFor}
          sizes={sizes}
          vm={vm}
          alias={selected ? names[selected.path] : undefined}
          onAlias={(label) => selected && onAlias(selected.path, label)}
          onChanged={onChanged}
        />
      </div>
    </div>
  );
}
