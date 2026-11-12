import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { MoveRequestSchema, planMove, type MoveDirection, type MoveProgress, type MoveRequest, type MoveResult } from "@vmc/shared";
import { Button, ToggleRow } from "@/components/controls";
import { OpenInRemoteT3Button } from "@/components/OpenInRemoteT3Button";
import type { VmSnapshot, Worktree } from "@/data/types";
import { counterpartOf } from "@/lib/worktrees";
import { findHostRepo } from "@/lib/hosts";
import { useHostName } from "@/lib/useHost";
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

function useMoveModel(tree: Worktree, all: readonly Worktree[]) {
  const [settings] = useSettings();
  const host = useHostName();
  const direction: MoveDirection = tree.location === "mac" ? "to-vm" : "to-mac";
  const twin = counterpartOf(tree, all);
  const macTree = tree.location === "mac" ? tree : twin;
  const vmTree = tree.location === "vm" ? tree : twin;
  const target = { host: settings.host.trim(), user: settings.user.trim() };
  const projectRepo = findHostRepo(settings.vmRepos, tree.repo);
  return { host, direction, macTree, vmTree, target, projectRepo };
}

export function HostActions({ tree, all, vm }: Omit<MovePanelProps, "onMoved">) {
  const { host, vmTree, target } = useMoveModel(tree, all);
  const openTerminal = (mode: "shell" | "claude") => {
    if (vmTree) void window.api.openVmTerminal({ target, path: vmTree.path, mode, sessionId: vmTree.sessions[0]?.id });
  };
  const reachable = vm?.reachable === true;
  const claudeMissing = vm?.health?.claudeInstalled === false;
  if (!vmTree) return null;
  return (
    <div className="mt-4 shrink-0">
      <OpenInRemoteT3Button tree={vmTree} reachable={reachable} />
      {reachable && (
        <>
          <div className="flex gap-2">
            <Button onClick={() => openTerminal("shell")} className="flex-1 !py-1.5">
              {`Open on ${host}`}
            </Button>
            <Button onClick={() => openTerminal("claude")} disabled={claudeMissing} title={claudeMissing ? `Claude Code isn't installed on ${host}` : undefined} className="flex-1 !py-1.5">
              Continue Claude there
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

export function MoveFooter({ tree, all, vm, onMoved }: MovePanelProps) {
  const { host, direction, macTree, vmTree, target, projectRepo } = useMoveModel(tree, all);
  const [separate, setSeparate] = useState(false);
  const [withEnv, setWithEnv] = useState(false);
  const [removeSource, setRemoveSource] = useState(false);
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<Record<string, MoveProgress>>({});
  const [result, setResult] = useState<MoveResult | null>(null);

  const hostRepo = direction === "to-vm" && !separate ? projectRepo : null;
  const branchOnly = hostRepo !== null;
  let reason: string | null = null;
  let request: MoveRequest | null = null;
  if (!vm?.reachable) {
    reason = vm?.error ?? `Checking ${host}…`;
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
      includeEnv: direction === "to-vm" && withEnv && tree.hasEnv && !branchOnly,
      removeSource,
      hostRepo,
    });
    if (parsed.success) request = parsed.data;
    else reason = `The name or branch has characters the ${host} path can't use.`;
  }

  const steps = planMove({ direction, branch: tree.branch ?? "", modified: tree.modified, sessions: tree.sessions.length, includeEnv: withEnv && !branchOnly, hasEnv: tree.hasEnv, removeSource, host, branchOnly });
  const origin = direction === "to-vm" ? "Mac" : host;
  const destination = direction === "to-vm" ? host : "Mac";
  const actionLabel = direction === "to-vm" ? `Send to ${host}` : "Bring back to the Mac";
  const showSteps = open || running || result !== null;

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

  return (
    <div className="shrink-0 border-t border-[var(--hairline)] pt-3">
      <AnimatePresence initial={false}>
        {showSteps && (
          <motion.div key="details" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="max-h-[38vh] overflow-y-auto">
            <p className="mb-1 text-xs leading-relaxed text-[var(--text-muted)]">{`This copies it. The original stays on the ${origin} unless you choose to remove it.`}</p>
            {direction === "to-vm" && projectRepo !== null && (
              <ToggleRow label="Make a separate worktree instead" hint={`By default only the branch goes into the project on ${host} and T3 makes the worktree. A separate worktree keeps your sessions and .env, but T3 won't know about it.`} checked={separate} onChange={setSeparate} disabled={running} />
            )}
            {direction === "to-vm" && tree.hasEnv && !branchOnly && <ToggleRow label="Include .env files" hint="Secrets stay behind unless you opt in." checked={withEnv} onChange={setWithEnv} disabled={running} />}
            <ToggleRow label={`Remove the ${origin} copy afterwards`} hint={`Only once the ${destination} copy is verified. Git refuses if anything changed in between.`} checked={removeSource} onChange={setRemoveSource} disabled={running} />
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
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {result && (
          <motion.p initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={`mb-3 rounded-xl bg-[var(--inset)] px-3 py-2 text-xs leading-relaxed ${result.ok ? "text-[var(--ok)]" : "text-[var(--down)]"}`}>
            {result.ok ? `Done.${result.note ? ` ${result.note}` : ""}${result.vmPath && direction === "to-vm" ? ` It lives at ${result.vmPath} on ${host}.` : ""}` : (result.error ?? "The move failed.")}
          </motion.p>
        )}
      </AnimatePresence>
      <Button variant="primary" disabled={request === null || running} onClick={() => void run()} className="w-full">
        {running ? (direction === "to-vm" ? "Sending…" : "Bringing back…") : removeSource ? `${actionLabel}, then remove the ${origin} copy` : actionLabel}
      </Button>
      <div className="mt-2 flex items-center justify-between gap-3 text-[11px] text-[var(--text-muted)]">
        <span className="min-w-0 flex-1 truncate">{reason ?? `${tree.branch ?? ""} → ${destination}`}</span>
        <button type="button" onClick={() => setOpen((value) => !value)} disabled={running} className="no-drag cursor-default whitespace-nowrap text-[var(--text-secondary)] outline-none transition-colors duration-200 hover:text-[var(--text-primary)]">
          {open ? "Hide options ▴" : "Options ▾"}
        </button>
      </div>
    </div>
  );
}
