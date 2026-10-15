import { Checkbox } from "@base-ui/react/checkbox";
import { Dialog } from "@base-ui/react/dialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { splitLines, useSettings } from "@/lib/settings";
import { Button, ToggleRow } from "@/components/controls";
import { Pill } from "@/components/Tile";
import { ProjectIcon } from "@/components/ProjectIcon";
import type { ProjectIcons } from "@vmc/shared";
import type { Worktree } from "@/data/types";
import { buildDeleteRequest } from "@/lib/delete";
import { formatBytes } from "@/lib/format";
import type { StaleInfo } from "@/lib/stale";

export interface StaleEntry {
  tree: Worktree;
  info: StaleInfo;
}

type RowState = { status: "running" } | { status: "done" } | { status: "skipped"; reason: string };

interface CleanupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entries: readonly StaleEntry[];
  sizes: Record<string, number | null>;
  icons: ProjectIcons;
  vmReachable: boolean;
  onChanged: () => void;
}

export function CleanupDialog({ open, onOpenChange, entries, sizes, icons, vmReachable, onChanged }: CleanupDialogProps) {
  const queryClient = useQueryClient();
  const [settings] = useSettings();
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [deleteBranches, setDeleteBranches] = useState(false);
  const [deleteSessions, setDeleteSessions] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [running, setRunning] = useState(false);
  const [states, setStates] = useState<Record<string, RowState>>({});
  const [summary, setSummary] = useState<string | null>(null);
  const [pruning, setPruning] = useState(false);

  const target = { host: settings.host.trim(), user: settings.user.trim() };
  const pruneInput = { repos: splitLines(settings.macRepos), vm: vmReachable ? { target, repos: splitLines(settings.vmRepos) } : null };
  const preview = useQuery({
    queryKey: ["prune-preview", pruneInput.repos, pruneInput.vm?.repos ?? null, vmReachable],
    queryFn: () => window.api.previewPrune(pruneInput),
    enabled: open,
    staleTime: 0,
    retry: false,
  });
  const leftovers = (preview.data?.entries ?? []).filter((entry) => entry.items.length > 0);
  const leftoverCount = leftovers.reduce((total, entry) => total + entry.items.length, 0);

  const blockedReason = (entry: StaleEntry): string | null => {
    if (entry.tree.modified > 0) return `${entry.tree.modified} uncommitted ${entry.tree.modified === 1 ? "change" : "changes"}. Open it to decide.`;
    if (entry.tree.location === "vm" && !vmReachable) return "The VM isn't reachable.";
    return null;
  };

  const sorted = [...entries].sort((a, b) => (sizes[b.tree.id] ?? 0) - (sizes[a.tree.id] ?? 0) || a.tree.lastActive - b.tree.lastActive);
  const selectable = sorted.filter((entry) => blockedReason(entry) === null);
  const chosen = sorted.filter((entry) => selected.has(entry.tree.id));
  const chosenBytes = chosen.reduce((total, entry) => total + (sizes[entry.tree.id] ?? 0), 0);

  const toggle = (id: string, checked: boolean) => {
    setConfirming(false);
    setSelected((previous) => {
      const next = new Set(previous);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const selectAll = () => {
    setConfirming(false);
    setSelected(selected.size === selectable.length ? new Set() : new Set(selectable.map((entry) => entry.tree.id)));
  };

  const runPrune = async () => {
    setPruning(true);
    try {
      await window.api.runPrune(pruneInput);
      await preview.refetch();
      onChanged();
    } finally {
      setPruning(false);
    }
  };

  const runDelete = async () => {
    setConfirming(false);
    setRunning(true);
    setSummary(null);
    setStates({});
    let deleted = 0;
    let skipped = 0;
    for (const entry of chosen) {
      setStates((previous) => ({ ...previous, [entry.tree.id]: { status: "running" } }));
      const request = buildDeleteRequest(entry.tree, target, { force: false, deleteBranch: deleteBranches, deleteSessions });
      if (!request) {
        skipped += 1;
        setStates((previous) => ({ ...previous, [entry.tree.id]: { status: "skipped", reason: "Unsafe path or branch name." } }));
        continue;
      }
      try {
        const result = await window.api.deleteWorktree(request);
        if (result.ok) {
          deleted += 1;
          setStates((previous) => ({ ...previous, [entry.tree.id]: { status: "done" } }));
        } else {
          skipped += 1;
          setStates((previous) => ({ ...previous, [entry.tree.id]: { status: "skipped", reason: result.error ?? "Skipped." } }));
        }
      } catch {
        skipped += 1;
        setStates((previous) => ({ ...previous, [entry.tree.id]: { status: "skipped", reason: "The delete couldn't start." } }));
      }
    }
    setSummary(`Deleted ${deleted} ${deleted === 1 ? "worktree" : "worktrees"}${skipped > 0 ? `, skipped ${skipped}` : ""}.`);
    setSelected(new Set());
    setRunning(false);
    onChanged();
    void queryClient.invalidateQueries({ queryKey: ["worktree-sizes"] });
  };

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !running && onOpenChange(next)}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/65 transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 flex max-h-[84vh] w-[760px] max-w-[94vw] -translate-x-1/2 -translate-y-1/2 flex-col rounded-3xl border border-[var(--hairline)] bg-[oklch(0.13_0.05_285)] p-5 shadow-2xl outline-none transition-[opacity,transform] duration-200 data-[ending-style]:scale-95 data-[starting-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0">
          <div className="mb-1 flex items-center justify-between gap-3">
            <Dialog.Title className="text-xl font-medium">Clean up worktrees</Dialog.Title>
            <Dialog.Close className="no-drag cursor-default rounded-full px-3 py-1 text-xs text-[var(--text-secondary)] outline-none transition-colors duration-200 hover:bg-white/10" disabled={running}>
              Close
            </Dialog.Close>
          </div>
          <Dialog.Description className="mb-4 text-xs text-[var(--text-secondary)]">
            {entries.length === 0 ? "Nothing looks stale right now." : `${entries.length} ${entries.length === 1 ? "worktree looks" : "worktrees look"} stale. Pick the ones to delete. Worktrees with uncommitted changes are never deleted from here.`}
          </Dialog.Description>

          <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl bg-[var(--inset)] px-3.5 py-2.5">
            <span className="text-xs text-[var(--text-secondary)]">
              {preview.isPending ? "Checking for leftover records…" : leftoverCount > 0 ? `${leftoverCount} leftover ${leftoverCount === 1 ? "record" : "records"} of worktrees whose folders are gone (${leftovers.map((entry) => `${entry.repo} on the ${entry.location === "vm" ? "VM" : "Mac"}`).join(", ")}).` : "No leftover records to prune."}
            </span>
            {leftoverCount > 0 && (
              <Button onClick={() => void runPrune()} disabled={pruning} className="!px-3 !py-1 text-xs">
                {pruning ? "Pruning…" : "Prune"}
              </Button>
            )}
          </div>

          <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
            {sorted.map((entry) => {
              const blocked = blockedReason(entry);
              const state = states[entry.tree.id];
              const size = sizes[entry.tree.id];
              return (
                <div key={entry.tree.id} className={`flex items-center gap-3 rounded-2xl border border-[var(--hairline)] bg-[var(--inset)] px-3.5 py-2.5 transition-opacity duration-200 ${blocked ? "opacity-60" : ""}`}>
                  <Checkbox.Root
                    checked={selected.has(entry.tree.id)}
                    onCheckedChange={(checked) => toggle(entry.tree.id, checked)}
                    disabled={blocked !== null || running}
                    aria-label={`Select ${entry.tree.name}`}
                    className="flex size-5 shrink-0 cursor-default items-center justify-center rounded-md border border-white/25 outline-none transition-colors duration-200 data-[checked]:border-[var(--accent)] data-[checked]:bg-[var(--accent)] data-[disabled]:opacity-40"
                  >
                    <Checkbox.Indicator className="text-[11px] leading-none text-white">✓</Checkbox.Indicator>
                  </Checkbox.Root>
                  <ProjectIcon repo={entry.tree.repo} icon={icons[entry.tree.repo]?.icon} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate">{entry.tree.name}</span>
                      <Pill tone={entry.tree.location === "vm" ? "ok" : "neutral"}>{entry.tree.location === "vm" ? "VM" : "Mac"}</Pill>
                    </div>
                    <div className="truncate text-[11px] text-[var(--text-secondary)]">{blocked ?? entry.info.reasons.join(" · ")}</div>
                  </div>
                  <span className="shrink-0 text-xs tabular-nums text-[var(--text-secondary)]">
                    {state?.status === "running" ? "deleting…" : state?.status === "done" ? "deleted" : state?.status === "skipped" ? "skipped" : typeof size === "number" ? formatBytes(size) : "…"}
                  </span>
                  {state?.status === "skipped" && <span className="max-w-[160px] truncate text-[11px] text-[var(--warn)]" title={state.reason}>{state.reason}</span>}
                </div>
              );
            })}
          </div>

          {entries.length > 0 && (
            <div className="mt-3 border-t border-[var(--hairline)] pt-3">
              <div className="grid grid-cols-2 gap-x-6">
                <ToggleRow label="Also delete merged branches" hint="Only branches that are fully merged." checked={deleteBranches} onChange={setDeleteBranches} disabled={running} />
                <ToggleRow label="Also delete Claude sessions" hint="Their transcripts. This can't be undone." checked={deleteSessions} onChange={setDeleteSessions} disabled={running} />
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="min-w-0 text-xs text-[var(--text-secondary)]">{summary ?? (chosen.length > 0 ? `${chosen.length} selected · about ${formatBytes(chosenBytes)}` : "Nothing selected")}</div>
                <div className="flex shrink-0 gap-2">
                  <Button onClick={selectAll} disabled={running || selectable.length === 0} className="!px-3 !py-1.5 text-xs">
                    {selected.size === selectable.length && selectable.length > 0 ? "Clear selection" : `Select all (${selectable.length})`}
                  </Button>
                  {confirming ? (
                    <>
                      <Button onClick={() => setConfirming(false)} className="!px-3 !py-1.5 text-xs">
                        Cancel
                      </Button>
                      <Button variant="danger" onClick={() => void runDelete()} className="!px-3 !py-1.5 text-xs">
                        {`Yes, delete ${chosen.length}`}
                      </Button>
                    </>
                  ) : (
                    <Button variant="danger" disabled={chosen.length === 0 || running} onClick={() => setConfirming(true)} className="!px-3 !py-1.5 text-xs">
                      {running ? "Deleting…" : `Delete ${chosen.length > 0 ? chosen.length : ""} selected`}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
