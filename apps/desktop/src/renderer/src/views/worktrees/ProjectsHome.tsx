import { motion } from "motion/react";
import type { ReactNode } from "react";
import { Button } from "@/components/controls";
import { useNavigate } from "@/lib/nav-context";
import type { Worktree } from "@/data/types";
import { formatBytes } from "@/lib/format";
import { originOf } from "@/lib/origin";
import { staleInfo } from "@/lib/stale";
import { ageDays, type ProjectGroup, type SizeMap } from "@/lib/worktreeModel";
import { Pill } from "@/components/Tile";
import { formatAge, ProjectMark, StateBar, STATE_META } from "./parts";

interface Stats {
  group: ProjectGroup;
  toClean: Worktree[];
  cleanBytes: number;
  lastActive: number;
  onVm: number;
  modified: number;
  pending: number;
  origins: { label: string; count: number }[];
}

const ORIGIN_LABEL: Record<string, string> = { conductor: "Conductor", t3code: "T3 Code", claude: "Claude agents", manual: "manual" };

function statsFor(group: ProjectGroup, sizes: SizeMap, days: number): Stats {
  const toClean = group.trees.filter((tree) => staleInfo(tree, days).stale);
  const origins = new Map<string, number>();
  for (const tree of group.trees) {
    if (tree.isMain) continue;
    const origin = originOf(tree);
    const label = ORIGIN_LABEL[origin.kind];
    if (!label) continue;
    origins.set(label, (origins.get(label) ?? 0) + 1);
  }
  return {
    group,
    toClean,
    cleanBytes: toClean.reduce((sum, tree) => sum + (sizes[tree.id] ?? 0), 0),
    lastActive: Math.max(0, ...group.trees.map((tree) => tree.lastActive)),
    onVm: group.trees.filter((tree) => tree.location === "vm").length,
    modified: group.trees.filter((tree) => tree.modified > 0).length,
    pending: group.trees.filter((tree) => sizes[tree.id] == null).length,
    origins: [...origins.entries()].sort((a, b) => b[1] - a[1]).map(([label, count]) => ({ label, count })),
  };
}

function sizeLabel(bytes: number, pending: number, total: number): string {
  if (total > 0 && pending === total) return "…";
  return `${formatBytes(bytes)}${pending > 0 ? "+" : ""}`;
}

function lastActiveLabel(stats: Stats, now: number): string {
  if (stats.lastActive === 0) return "no activity yet";
  const days = ageDays({ lastActive: stats.lastActive }, now);
  return days < 1 ? "active today" : `active ${formatAge(days)} ago`;
}

function Big({ value, label, tone }: { value: string; label: string; tone?: string }) {
  return (
    <div className="min-w-0">
      <div className="whitespace-nowrap text-2xl font-medium leading-none tracking-tight tabular-nums" style={tone ? { color: tone } : undefined}>
        {value}
      </div>
      <div className="mt-1 text-[11px] text-[var(--text-secondary)]">{label}</div>
    </div>
  );
}

interface ProjectsHomeProps {
  groups: ProjectGroup[];
  sizes: SizeMap;
  icons: Record<string, { icon: string | null } | undefined>;
  now: number;
  days: number;
  loading: boolean;
  problem: ReactNode;
  onOpen: (repo: string) => void;
  onCleanup: () => void;
}

export function ProjectsHome({ groups, sizes, icons, now, days, loading, problem, onOpen, onCleanup }: ProjectsHomeProps) {
  const go = useNavigate();
  const stats = groups.map((group) => statsFor(group, sizes, days));
  const worktrees = stats.reduce((sum, entry) => sum + entry.group.trees.length, 0);
  const bytes = stats.reduce((sum, entry) => sum + entry.group.bytes, 0);
  const pending = stats.reduce((sum, entry) => sum + entry.pending, 0);
  const toClean = stats.reduce((sum, entry) => sum + entry.toClean.length, 0);
  const cleanBytes = stats.reduce((sum, entry) => sum + entry.cleanBytes, 0);

  return (
    <div className="flex h-full min-h-0 flex-col gap-5 overflow-y-auto pr-1">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-2xl font-medium tracking-tight">Projects</div>
          <div className="mt-1 text-sm text-[var(--text-secondary)]">{loading ? "Reading your worktrees…" : `${stats.length} projects · ${worktrees} worktrees · ${sizeLabel(bytes, pending, worktrees)} on disk`}</div>
        </div>
        {toClean > 0 ? (
          <div className="flex items-center gap-3 rounded-2xl border border-[var(--warn)]/35 bg-[var(--warn)]/10 py-1.5 pl-4 pr-2 text-sm">
            <span>
              <span className="font-medium text-[var(--warn)]">{`${toClean} worktrees`}</span>
              <span className="text-[var(--text-secondary)]">{` are old or merged${pending > 0 ? "" : ` · ${formatBytes(cleanBytes)} to free`}`}</span>
            </span>
            <Button onClick={onCleanup} className="!px-3 !py-1 text-xs">
              Clean up
            </Button>
          </div>
        ) : (
          !loading && <div className="rounded-2xl border border-[var(--ok)]/30 bg-[var(--ok)]/10 px-4 py-2 text-sm text-[var(--ok)]">Everything is tidy</div>
        )}
      </div>
      {problem}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4 pb-6">
        {stats.map((entry, index) => (
          <motion.button
            key={entry.group.repo}
            type="button"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -3 }}
            transition={{ duration: 0.25, delay: Math.min(index, 8) * 0.04 }}
            onClick={() => onOpen(entry.group.repo)}
            className="no-drag flex cursor-default flex-col gap-5 rounded-[26px] border border-[var(--hairline)] bg-[var(--glass)] p-5 text-left shadow-[inset_0_1px_0_oklch(1_0_0/0.06)] outline-none transition-colors duration-200 hover:border-[var(--accent)]/50 hover:bg-white/[0.06]"
          >
            <div className="flex items-center gap-4">
              <ProjectMark repo={entry.group.repo} icon={icons[entry.group.repo]?.icon} size="lg" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-lg font-medium">{entry.group.repo}</div>
                <div className="text-xs text-[var(--text-secondary)]">{lastActiveLabel(entry, now)}</div>
              </div>
              <span aria-hidden="true" className="text-lg text-[var(--text-muted)]">›</span>
            </div>
            <div className="flex items-end gap-7">
              <Big value={String(entry.group.trees.length)} label="worktrees" />
              <Big value={sizeLabel(entry.group.bytes, entry.pending, entry.group.trees.length)} label="on disk" />
              <Big value={String(entry.toClean.length)} label="to clean" tone={entry.toClean.length > 0 ? STATE_META.stale.color : "var(--text-secondary)"} />
            </div>
            <div className="flex flex-col gap-2">
              <StateBar states={entry.group.states} />
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[var(--text-secondary)]">
                {(["active", "idle", "stale", "merged", "both"] as const).map((state) =>
                  entry.group.states[state] > 0 ? (
                    <span key={state} className="flex items-center gap-1.5">
                      <span className="size-1.5 rounded-full" style={{ background: STATE_META[state].color }} />
                      {`${entry.group.states[state]} ${STATE_META[state].label.toLowerCase()}`}
                    </span>
                  ) : null,
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {entry.onVm > 0 && <Pill tone="ok">{`${entry.onVm} on the VM`}</Pill>}
              {entry.modified > 0 && <Pill tone="warn">{`${entry.modified} with changes`}</Pill>}
              {entry.origins.slice(0, 3).map((origin) => (
                <Pill key={origin.label}>{`${origin.count} ${origin.label}`}</Pill>
              ))}
            </div>
          </motion.button>
        ))}
        <button
          type="button"
          onClick={() => go("settings")}
          className="no-drag grid min-h-[260px] cursor-default place-items-center rounded-[26px] border border-dashed border-[var(--hairline)] text-center text-sm text-[var(--text-muted)] outline-none transition-colors duration-200 hover:border-[var(--accent)]/50 hover:text-[var(--text-secondary)]"
        >
          <span>
            <span className="mx-auto mb-2 grid size-10 place-items-center rounded-full border border-[var(--hairline)] text-lg">+</span>
            Add a repository
            <span className="block text-xs">in Settings</span>
          </span>
        </button>
      </div>
    </div>
  );
}
