import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { Button, Segmented, ToggleRow } from "@/components/controls";
import { HoldButton } from "@/components/HoldButton";
import type { Worktree } from "@/data/types";
import { buildDeleteRequest } from "@/lib/delete";
import { formatBytes } from "@/lib/format";
import { useSettings } from "@/lib/settings";

type Step = "idle" | "confirm" | "force" | "done";
type Scope = "mac" | "vm" | "both";

interface DeleteWorktreePanelProps {
  tree: Worktree;
  twin: Worktree | null;
  vmReachable: boolean;
  sizes: Record<string, number | null | undefined>;
  onDeleted: () => void;
}

function blockedReason(tree: Worktree, vmReachable: boolean): string | null {
  if (tree.isMain) return "This is the project's main checkout, so it can't be deleted here.";
  if (tree.location === "vm" && !vmReachable) return "The VM isn't reachable.";
  return null;
}

const PLACE = { mac: "Mac", vm: "VM" } as const;

export function DeleteWorktreePanel({ tree, twin, vmReachable, sizes, onDeleted }: DeleteWorktreePanelProps) {
  const [settings] = useSettings();
  const [step, setStep] = useState<Step>("idle");
  const [scope, setScope] = useState<Scope>(tree.location);
  const [deleteBranch, setDeleteBranch] = useState(false);
  const [deleteSessions, setDeleteSessions] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [deleted, setDeleted] = useState<string[]>([]);
  const [pending, setPending] = useState<Worktree[]>([]);

  const target = { host: settings.host.trim(), user: settings.user.trim() };
  const mac = tree.location === "mac" ? tree : twin;
  const vm = tree.location === "vm" ? tree : twin;
  const chosen = useMemo(() => {
    const list = scope === "both" ? [mac, vm] : scope === "mac" ? [mac] : [vm];
    return list.filter((entry): entry is Worktree => entry !== null);
  }, [scope, mac, vm]);

  const reasons = chosen.map((entry) => blockedReason(entry, vmReachable)).filter((reason): reason is string => reason !== null);
  const selfBlocked = twin === null ? blockedReason(tree, vmReachable) : null;
  const sizeFor = (entry: Worktree) => sizes[entry.id];
  const totalSize = chosen.reduce((sum, entry) => sum + (typeof sizeFor(entry) === "number" ? (sizeFor(entry) ?? 0) : 0), 0);
  const branchSource = chosen.find((entry) => entry.branch) ?? null;
  const sessionCount = chosen.reduce((sum, entry) => sum + entry.sessions.length, 0);
  const current = pending[0] ?? null;

  const scopeOptions = [
    { value: "mac", label: "Mac copy" },
    { value: "vm", label: "VM copy" },
    { value: "both", label: "Both" },
  ] as const;

  const runQueue = async (queue: Worktree[], force: boolean) => {
    setBusy(true);
    setError(null);
    const remaining = [...queue];
    const doneNow: string[] = [];
    const collected: string[] = [];
    try {
      while (remaining.length > 0) {
        const entry = remaining[0];
        if (!entry) break;
        const request = buildDeleteRequest(entry, target, { force: force && remaining.length === queue.length, deleteBranch, deleteSessions });
        if (!request) {
          setError("This worktree's path or branch has characters that can't be handled safely.");
          setPending(remaining);
          return;
        }
        const result = await window.api.deleteWorktree(request);
        if (result.ok) {
          doneNow.push(`${entry.name} (${PLACE[entry.location]})`);
          collected.push(...result.notes);
          remaining.shift();
          force = false;
        } else if (result.needsForce) {
          setPending(remaining);
          setDeleted((previous) => [...previous, ...doneNow]);
          setNotes((previous) => [...previous, ...collected]);
          setStep("force");
          return;
        } else {
          setPending(remaining);
          setDeleted((previous) => [...previous, ...doneNow]);
          setNotes((previous) => [...previous, ...collected]);
          setError(result.error ?? "The delete failed.");
          return;
        }
      }
      setPending([]);
      setDeleted((previous) => [...previous, ...doneNow]);
      setNotes((previous) => [...previous, ...collected]);
      setStep("done");
      onDeleted();
    } catch {
      setPending(remaining);
      setError("The delete couldn't be started.");
    } finally {
      setBusy(false);
    }
  };

  if (selfBlocked) return <p className="mt-4 shrink-0 text-center text-[11px] text-[var(--text-muted)]">{selfBlocked}</p>;

  const heading = chosen.length === 2 ? `Delete both copies of ${tree.name}` : `Delete ${chosen[0]?.name ?? tree.name} from the ${chosen[0] ? PLACE[chosen[0].location] : PLACE[tree.location]}`;

  return (
    <div className="mt-4 shrink-0 border-t border-[var(--hairline)] pt-3">
      <AnimatePresence mode="wait" initial={false}>
        {step === "idle" && (
          <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex justify-center">
            <button
              type="button"
              onClick={() => {
                setScope(tree.location);
                setStep("confirm");
              }}
              className="no-drag cursor-default rounded-full px-3 py-1 text-xs text-[var(--down)] outline-none transition-colors duration-200 hover:bg-[var(--down)]/15"
            >
              {twin ? "Delete a copy…" : "Delete this worktree…"}
            </button>
          </motion.div>
        )}
        {step === "confirm" && (
          <motion.div key="confirm" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {twin && (
              <div className="mb-3">
                <div className="mb-1.5 text-xs text-[var(--text-secondary)]">This worktree is on the Mac and the VM. Which copy do you want to delete?</div>
                <Segmented id="delete-scope" label="Delete which copy" options={scopeOptions} value={scope} onChange={setScope} />
              </div>
            )}
            <div className="mb-1">{`${heading}${totalSize > 0 ? ` and free ${formatBytes(totalSize)}` : ""}?`}</div>
            <p className="text-xs text-[var(--text-secondary)]">Git refuses if a copy has uncommitted changes, so nothing unsaved is lost by accident.</p>
            {scope !== "both" && twin && <p className="mt-1 text-xs text-[var(--text-secondary)]">{`The ${PLACE[scope === "mac" ? "vm" : "mac"]} copy stays where it is.`}</p>}
            {branchSource?.branch && <ToggleRow label="Also delete the branch" hint={`${branchSource.branch}. Only if it's fully merged.`} checked={deleteBranch} onChange={setDeleteBranch} />}
            {sessionCount > 0 && <ToggleRow label="Also delete its Claude sessions" hint={`${sessionCount} ${sessionCount === 1 ? "session" : "sessions"}. This can't be undone.`} checked={deleteSessions} onChange={setDeleteSessions} />}
            {reasons.length > 0 && <p className="mt-2 text-xs text-[var(--warn)]">{reasons[0]}</p>}
            {error && <p className="mt-2 text-xs text-[var(--down)]">{error}</p>}
            <div className="mt-3 flex gap-2">
              <Button onClick={() => setStep("idle")} disabled={busy} className="flex-1 !py-1.5">
                Cancel
              </Button>
              <Button variant="danger" onClick={() => void runQueue(chosen, false)} disabled={busy || reasons.length > 0 || chosen.length === 0} className="flex-1 !py-1.5">
                {busy ? "Deleting…" : chosen.length === 2 ? "Delete both" : "Delete worktree"}
              </Button>
            </div>
          </motion.div>
        )}
        {step === "force" && current && (
          <motion.div key="force" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <p className="text-xs leading-relaxed text-[var(--warn)]">{`The ${PLACE[current.location]} copy of ${current.name} has ${current.modified > 0 ? `${current.modified} uncommitted ${current.modified === 1 ? "change" : "changes"}` : "uncommitted changes"}. Deleting it now loses them for good.`}</p>
            {error && <p className="mt-2 text-xs text-[var(--down)]">{error}</p>}
            <div className="mt-3 flex gap-2">
              <Button
                onClick={() => {
                  setPending([]);
                  setStep(deleted.length > 0 ? "done" : "idle");
                  if (deleted.length > 0) onDeleted();
                }}
                disabled={busy}
                className="flex-1 !py-1.5"
              >
                Keep it
              </Button>
              <HoldButton onConfirm={() => void runQueue(pending, true)} disabled={busy} holdingLabel="Keep holding…" className="flex-1 !py-1.5">
                {busy ? "Deleting…" : "Hold to delete anyway"}
              </HoldButton>
            </div>
          </motion.div>
        )}
        {step === "done" && (
          <motion.p key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs leading-relaxed text-[var(--ok)]">
            {`Deleted ${deleted.join(" and ")}.${notes.length > 0 ? ` ${notes.join(" ")}` : ""}`}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
