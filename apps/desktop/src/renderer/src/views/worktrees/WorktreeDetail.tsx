import type { T3Threads, ToolsInfo } from "@vmc/shared";
import { Button } from "@/components/controls";
import { DeleteWorktreePanel } from "@/components/DeleteWorktreePanel";
import { MacTerminalButton } from "@/components/TerminalButtons";
import { OpenInToolButton } from "@/components/OpenInToolButton";
import { OriginBadge } from "@/components/OriginBadge";
import { ProjectIconEditor } from "@/components/ProjectIconEditor";
import { Pill, Tile } from "@/components/Tile";
import { TwinSyncCard } from "@/components/TwinSyncCard";
import type { VmSnapshot, Worktree } from "@/data/types";
import { formatBytes } from "@/lib/format";
import type { Origin } from "@/lib/origin";
import { useSettings } from "@/lib/settings";
import { staleInfo } from "@/lib/stale";
import { timeAgo } from "@/lib/time";
import { PLACE } from "@/lib/worktrees";
import { MovePanel, Stat } from "./MovePanel";
import { Rename } from "./parts";

interface WorktreeDetailProps {
  selected: Worktree | null;
  twin: Worktree | null;
  worktrees: readonly Worktree[];
  icons: Record<string, { icon: string | null; custom: boolean } | undefined>;
  tools: ToolsInfo | undefined;
  t3Threads: T3Threads;
  originFor: (tree: Worktree) => Origin;
  sizes: Record<string, number | null | undefined>;
  vm: VmSnapshot | undefined;
  alias: string | undefined;
  onAlias: (label: string | null) => void;
  onChanged: () => void;
}

export function WorktreeDetail({ selected, twin, worktrees, icons, tools, t3Threads, originFor, sizes, vm, alias, onAlias, onChanged }: WorktreeDetailProps) {
  const [settings] = useSettings();
  return (
    <Tile className="min-h-0" tone="light" index={1} title="Selected" action={selected && <Pill>{PLACE[selected.location]}</Pill>}>
      {selected ? (
        <div key={selected.id} className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <div className="flex shrink-0 items-center gap-3">
            <ProjectIconEditor repo={selected.repo} info={icons[selected.repo]} />
            <div className="min-w-0">
              <div className="truncate text-3xl font-medium leading-tight">{alias ?? selected.name}</div>
              {alias && <div className="truncate text-xs text-[var(--text-muted)]">{`Folder: ${selected.name}`}</div>}
            </div>
          </div>
          <div className="mt-1 shrink-0 truncate text-xs text-[var(--text-secondary)]" title={selected.path}>
            {selected.path}
          </div>
          <div className="mt-2 shrink-0">
            <Rename tree={selected} alias={alias} onAlias={onAlias} />
          </div>
          <div className="mt-3 flex shrink-0 flex-wrap items-center gap-2 text-xs text-[var(--text-secondary)]">
            <span>From</span>
            <OriginBadge origin={originFor(selected)} tools={tools} size="md" />
            {originFor(selected).detail && <span className="text-[var(--text-muted)]">{originFor(selected).detail}</span>}
          </div>
          {selected.location === "mac" && (
            <div className="mt-3 shrink-0 space-y-2">
              <OpenInToolButton tree={selected} origin={originFor(selected)} tools={tools} threadTitle={t3Threads[selected.path]?.title ?? null} />
              <div className="grid grid-cols-2 gap-2">
                <MacTerminalButton path={selected.path} className="w-full" />
                <Button onClick={() => void window.api.revealInFinder(selected.path)} className="w-full !py-1.5">
                  Reveal in Finder
                </Button>
              </div>
            </div>
          )}
          <div className="mt-4 grid shrink-0 grid-cols-4 gap-2">
            <Stat label="Modified" value={String(selected.modified)} />
            <Stat label="Ahead · behind" value={`${selected.ahead} · ${selected.behind}`} />
            <Stat label="Last active" value={timeAgo(selected.lastActive).replace(" ago", "")} />
            <Stat label="Disk size" value={typeof sizes[selected.id] === "number" ? formatBytes(sizes[selected.id] ?? 0) : "…"} />
          </div>
          {twin && <TwinSyncCard key={`${selected.id}-${twin.id}`} mac={selected.location === "mac" ? selected : twin} vm={selected.location === "vm" ? selected : twin} vmReachable={vm?.reachable ?? false} onSynced={onChanged} />}
          {staleInfo(selected, settings.staleDays).stale && <p className="mt-2 shrink-0 text-xs text-[var(--warn)]">{`Stale: ${staleInfo(selected, settings.staleDays).reasons.join(" · ")}`}</p>}
          <div className="mb-1.5 mt-4 shrink-0 text-xs text-[var(--text-secondary)]">Claude sessions</div>
          <div className="max-h-32 shrink-0 space-y-1.5 overflow-y-auto">
            {selected.sessions.length === 0 && <p className="text-xs text-[var(--text-muted)]">No sessions for this worktree.</p>}
            {selected.sessions.map((session) => (
              <div key={session.id} className="flex items-center justify-between gap-3 rounded-xl bg-[var(--inset)] px-3 py-2">
                <span className="truncate">{session.title}</span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="text-[11px] text-[var(--text-secondary)]">{`${session.messages} lines · ${timeAgo(session.lastActive)}`}</span>
                  {selected.location === "vm" && vm?.reachable === true && (
                    <Button onClick={() => void window.api.openVmTerminal({ target: { host: settings.host.trim(), user: settings.user.trim() }, path: selected.path, mode: "claude", sessionId: session.id })} title="Open this conversation in a terminal on the VM" className="!px-3 !py-0.5 text-[11px]">
                      Resume
                    </Button>
                  )}
                </span>
              </div>
            ))}
          </div>
          <MovePanel key={selected.id} tree={selected} all={worktrees} vm={vm} onMoved={onChanged} />
          <DeleteWorktreePanel key={`delete-${selected.id}`} tree={selected} twin={twin} vmReachable={vm?.reachable ?? false} sizes={sizes} onDeleted={onChanged} />
        </div>
      ) : (
        <p className="text-xs text-[var(--text-muted)]">Select a worktree to see its sessions and move it.</p>
      )}
    </Tile>
  );
}
