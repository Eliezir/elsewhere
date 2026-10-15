import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Button, FIELD, ToggleRow } from "@/components/controls";
import type { Worktree } from "@/data/types";
import { buildDeleteRequest } from "@/lib/delete";
import { formatBytes } from "@/lib/format";
import { useSettings } from "@/lib/settings";

type Step = "idle" | "confirm" | "force" | "done";

interface DeleteWorktreePanelProps {
  tree: Worktree;
  vmReachable: boolean;
  size: number | null | undefined;
  onDeleted: () => void;
}

export function DeleteWorktreePanel({ tree, vmReachable, size, onDeleted }: DeleteWorktreePanelProps) {
  const [settings] = useSettings();
  const [step, setStep] = useState<Step>("idle");
  const [deleteBranch, setDeleteBranch] = useState(false);
  const [deleteSessions, setDeleteSessions] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<string[]>([]);

  const target = { host: settings.host.trim(), user: settings.user.trim() };
  const blocked = tree.isMain ? "This is the project's main checkout, so it can't be deleted here." : tree.location === "vm" && !vmReachable ? "The VM isn't reachable." : null;

  const send = async (force: boolean) => {
    const request = buildDeleteRequest(tree, target, { force, deleteBranch, deleteSessions });
    if (!request) {
      setError("This worktree's path or branch has characters that can't be handled safely.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await window.api.deleteWorktree(request);
      if (result.ok) {
        setNotes(result.notes);
        setStep("done");
        onDeleted();
      } else if (result.needsForce) {
        setStep("force");
      } else {
        setError(result.error ?? "The delete failed.");
      }
    } catch {
      setError("The delete couldn't be started.");
    } finally {
      setBusy(false);
    }
  };

  if (blocked) return <p className="mt-4 shrink-0 text-center text-[11px] text-[var(--text-muted)]">{blocked}</p>;

  return (
    <div className="mt-4 shrink-0 border-t border-[var(--hairline)] pt-3">
      <AnimatePresence mode="wait" initial={false}>
        {step === "idle" && (
          <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex justify-center">
            <button type="button" onClick={() => setStep("confirm")} className="no-drag cursor-default rounded-full px-3 py-1 text-xs text-[var(--down)] outline-none transition-colors duration-200 hover:bg-[var(--down)]/15">
              Delete this worktree…
            </button>
          </motion.div>
        )}
        {step === "confirm" && (
          <motion.div key="confirm" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="mb-1">{`Delete ${tree.name}${typeof size === "number" ? ` and free ${formatBytes(size)}` : ""}?`}</div>
            <p className="text-xs text-[var(--text-secondary)]">Git refuses if it has uncommitted changes, so nothing unsaved is lost by accident.</p>
            {tree.branch && <ToggleRow label={`Also delete the branch`} hint={`${tree.branch}. Only if it's fully merged.`} checked={deleteBranch} onChange={setDeleteBranch} />}
            {tree.sessions.length > 0 && (
              <ToggleRow label="Also delete its Claude sessions" hint={`${tree.sessions.length} ${tree.sessions.length === 1 ? "session" : "sessions"}. This can't be undone.`} checked={deleteSessions} onChange={setDeleteSessions} />
            )}
            {error && <p className="mt-2 text-xs text-[var(--down)]">{error}</p>}
            <div className="mt-3 flex gap-2">
              <Button onClick={() => setStep("idle")} disabled={busy} className="flex-1 !py-1.5">
                Cancel
              </Button>
              <Button variant="danger" onClick={() => void send(false)} disabled={busy} className="flex-1 !py-1.5">
                {busy ? "Deleting…" : "Delete worktree"}
              </Button>
            </div>
          </motion.div>
        )}
        {step === "force" && (
          <motion.div key="force" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <p className="text-xs leading-relaxed text-[var(--warn)]">{`${tree.name} has ${tree.modified > 0 ? `${tree.modified} uncommitted ${tree.modified === 1 ? "change" : "changes"}` : "uncommitted changes"}. Deleting it now loses them for good.`}</p>
            <label className="mt-3 block">
              <span className="mb-1 block text-xs text-[var(--text-secondary)]">{`Type ${tree.name} to delete it anyway`}</span>
              <input value={typed} onChange={(event) => setTyped(event.target.value)} spellCheck={false} className={`${FIELD} !py-2`} />
            </label>
            {error && <p className="mt-2 text-xs text-[var(--down)]">{error}</p>}
            <div className="mt-3 flex gap-2">
              <Button onClick={() => setStep("idle")} disabled={busy} className="flex-1 !py-1.5">
                Keep it
              </Button>
              <Button variant="danger" onClick={() => void send(true)} disabled={busy || typed !== tree.name} className="flex-1 !py-1.5">
                {busy ? "Deleting…" : "Delete anyway"}
              </Button>
            </div>
          </motion.div>
        )}
        {step === "done" && (
          <motion.p key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs leading-relaxed text-[var(--ok)]">
            {`Deleted ${tree.name}.${notes.length > 0 ? ` ${notes.join(" ")}` : ""}`}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
