import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { MoveRequestSchema, planMove, type MoveDirection, type MoveProgress, type MoveRequest, type MoveResult } from "@vmc/shared";
import { Button, ToggleRow } from "@/components/controls";
import { OpenVmInClaudeButton } from "@/components/OpenVmInClaudeButton";
import type { VmSnapshot, Worktree } from "@/data/types";
import { counterpartOf } from "@/lib/worktrees";
import { useSettings } from "@/lib/settings";

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[var(--inset)] px-3 py-2.5">
      <div className="truncate text-lg font-medium">{value}</div>
      <div className="text-[11px] text-[var(--text-secondary)]">{label}</div>
    </div>
  );
}

function StepMark({ status }: { status: MoveProgress["status"] | undefined }) {
  const mark =
    status === "done" ? (
      <span className="text-[var(--ok)]">✓</span>
    ) : status === "failed" ? (
      <span className="text-[var(--down)]">✕</span>
    ) : status === "running" ? (
      <span className="size-2 animate-pulse rounded-full bg-[var(--accent)]" />
    ) : (
      <span className="size-1.5 rounded-full bg-white/20" />
    );
  return <span className="flex h-4 w-4 shrink-0 items-center justify-center">{mark}</span>;
}

interface MovePanelProps {
  tree: Worktree;
  all: readonly Worktree[];
  vm: VmSnapshot | undefined;
  onMoved: () => void;
}

export function MovePanel({ tree, all, vm, onMoved }: MovePanelProps) {
  const [settings] = useSettings();
  const [withEnv, setWithEnv] = useState(false);
  const [removeSource, setRemoveSource] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<Record<string, MoveProgress>>({});
  const [result, setResult] = useState<MoveResult | null>(null);

  const direction: MoveDirection = tree.location === "mac" ? "to-vm" : "to-mac";
  const twin = counterpartOf(tree, all);
  const macTree = tree.location === "mac" ? tree : twin;
  const vmTree = tree.location === "vm" ? tree : twin;
  const target = { host: settings.host.trim(), user: settings.user.trim() };

  let reason: string | null = null;
  let request: MoveRequest | null = null;
  if (!vm?.reachable) {
    reason = vm?.error ?? "Checking the VM…";
  } else if (tree.branch === null) {
    reason = "Check out a branch first. This worktree is on a detached HEAD.";
  } else if (direction === "to-mac" && !macTree) {
    reason = "No Mac worktree has this branch yet. Create one on the Mac first.";
  } else {
    const parsed = MoveRequestSchema.safeParse({
      direction,
      target,
      repo: tree.repo,
      name: tree.name,
      branch: tree.branch,
      macPath: macTree?.path ?? tree.path,
      vmPath: vmTree?.path ?? null,
      includeEnv: direction === "to-vm" && withEnv && tree.hasEnv,
      removeSource,
    });
    if (parsed.success) request = parsed.data;
    else reason = "The name or branch has characters the VM path can't use.";
  }

  const steps = planMove({ direction, branch: tree.branch ?? "", modified: tree.modified, sessions: tree.sessions.length, includeEnv: withEnv, hasEnv: tree.hasEnv, removeSource });
  const origin = direction === "to-vm" ? "Mac" : "VM";
  const actionLabel = direction === "to-vm" ? "Send to the VM" : "Bring back to the Mac";

  const run = async () => {
    if (!request) return;
    setRunning(true);
    setResult(null);
    setProgress({});
    const stop = window.api.onMoveProgress((event) => setProgress((previous) => ({ ...previous, [event.step]: event })));
    try {
      const moved = await window.api.startMove(request);
      setResult(moved);
    } catch {
      setResult({ ok: false, error: "The move couldn't start.", note: null, vmPath: null });
    } finally {
      stop();
      setRunning(false);
      onMoved();
    }
  };

  const openTerminal = (mode: "shell" | "claude") => {
    if (vmTree) void window.api.openVmTerminal({ target, path: vmTree.path, mode, sessionId: vmTree.sessions[0]?.id });
  };

  const canOpen = vmTree !== null && vm?.reachable === true;
  const claudeMissing = vm?.health?.claudeInstalled === false;

  return (
    <div className="mt-auto shrink-0 pt-4">
      {canOpen && vmTree && <OpenVmInClaudeButton tree={vmTree} vmReachable={vm?.reachable === true} />}
      {canOpen && (
        <div className="mb-4 flex gap-2">
          <Button onClick={() => openTerminal("shell")} className="flex-1 !py-1.5">
            Open on the VM
          </Button>
          <Button onClick={() => openTerminal("claude")} disabled={claudeMissing} title={claudeMissing ? "Claude Code isn't installed on the VM" : undefined} className="flex-1 !py-1.5">
            Continue Claude there
          </Button>
        </div>
      )}
      <div className="mb-1 text-xs text-[var(--text-secondary)]">{actionLabel}</div>
      <p className="mb-1 text-xs leading-relaxed text-[var(--text-muted)]">{`This copies it. The original stays on the ${origin} unless you choose to remove it.`}</p>
      {direction === "to-vm" && tree.hasEnv && <ToggleRow label="Include .env files" hint="Secrets stay behind unless you opt in." checked={withEnv} onChange={setWithEnv} disabled={running} />}
      <ToggleRow
        label={`Remove the ${origin} copy afterwards`}
        hint={`Only once the ${direction === "to-vm" ? "VM" : "Mac"} copy is verified. Git refuses if anything changed in between.`}
        checked={removeSource}
        onChange={setRemoveSource}
        disabled={running}
      />
      <ol className="my-3 space-y-1.5 text-xs">
        {steps.map((step) => {
          const state = progress[step.id];
          return (
            <li key={step.id} className="flex items-start gap-2">
              <StepMark status={state?.status} />
              <span className={state?.status === "failed" ? "text-[var(--down)]" : "text-[var(--text-secondary)]"}>
                {step.label}
                {state?.detail && <span className="text-[var(--text-muted)]">{` · ${state.detail}`}</span>}
              </span>
            </li>
          );
        })}
      </ol>
      <AnimatePresence>
        {result && (
          <motion.p
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`mb-3 rounded-xl bg-[var(--inset)] px-3 py-2 text-xs leading-relaxed ${result.ok ? "text-[var(--ok)]" : "text-[var(--down)]"}`}
          >
            {result.ok ? `Done.${result.note ? ` ${result.note}` : ""}${result.vmPath && direction === "to-vm" ? ` It lives at ${result.vmPath} on the VM.` : ""}` : (result.error ?? "The move failed.")}
          </motion.p>
        )}
      </AnimatePresence>
      <Button variant="primary" disabled={request === null || running} onClick={() => void run()} className="w-full">
        {running ? (direction === "to-vm" ? "Sending…" : "Bringing back…") : removeSource ? `${actionLabel}, then remove the ${origin} copy` : actionLabel}
      </Button>
      {reason && <p className="mt-2 text-center text-[11px] text-[var(--text-muted)]">{reason}</p>}
    </div>
  );
}

