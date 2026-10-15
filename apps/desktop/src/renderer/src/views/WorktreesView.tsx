import { Input } from "@base-ui/react/input";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { MoveRequestSchema, planMove, type MoveDirection, type MoveProgress, type MoveRequest, type MoveResult } from "@vmc/shared";
import { Button, FIELD, Segmented, ToggleRow } from "@/components/controls";
import { ApproveSshButton } from "@/components/ApproveSshButton";
import { ConnectTailscaleButton } from "@/components/ConnectTailscaleButton";
import { Pill, Tile } from "@/components/Tile";
import { useQueryClient } from "@tanstack/react-query";
import { ProjectIcon } from "@/components/ProjectIcon";
import { ProjectIconEditor } from "@/components/ProjectIconEditor";
import { useProjectIcons, useWorktrees } from "@/data/hooks";
import type { Location, VmSnapshot, Worktree } from "@/data/types";
import { useSettings } from "@/lib/settings";
import { timeAgo } from "@/lib/time";

type Filter = "all" | Location;

const FILTERS = [
  { value: "all", label: "All" },
  { value: "mac", label: "Mac" },
  { value: "vm", label: "VM" },
] as const;

const PLACE: Record<Location, string> = { mac: "Mac", vm: "VM" };

function counterpartOf(tree: Worktree, all: readonly Worktree[]): Worktree | null {
  if (tree.branch === null) return null;
  return all.find((other) => other.location !== tree.location && other.repo === tree.repo && other.branch === tree.branch) ?? null;
}

function Chip({ children, tone }: { children: string; tone?: "warn" | "ok" }) {
  const color = tone === "warn" ? "text-[var(--warn)]" : tone === "ok" ? "text-[var(--ok)]" : "text-[var(--text-secondary)]";
  return <span className={`rounded-full bg-[var(--inset)] px-2 py-0.5 text-[11px] ${color}`}>{children}</span>;
}

function Row({ tree, icon, selected, index, hasTwin, onSelect }: { tree: Worktree; icon: string | null | undefined; selected: boolean; index: number; hasTwin: boolean; onSelect: () => void }) {
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: Math.min(index, 8) * 0.02 }}
      onClick={onSelect}
      className={`no-drag flex w-full shrink-0 cursor-default items-center justify-between gap-4 rounded-2xl border px-4 py-3 text-left outline-none transition-colors duration-200 ${selected ? "border-[var(--accent)] bg-[var(--accent)]/15" : "border-[var(--hairline)] bg-[var(--inset)] hover:bg-white/5"}`}
    >
      <ProjectIcon repo={tree.repo} icon={icon} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[15px]">{tree.name}</span>
          <Pill tone={tree.location === "vm" ? "ok" : "neutral"}>{PLACE[tree.location]}</Pill>
          {hasTwin && <Pill>{tree.location === "mac" ? "also on VM" : "also on Mac"}</Pill>}
        </div>
        <div className="mt-0.5 truncate text-xs text-[var(--text-secondary)]">{`${tree.repo} · ${tree.branch ?? "detached HEAD"}`}</div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {tree.modified > 0 && <Chip tone="warn">{`${tree.modified} modified`}</Chip>}
        {(tree.ahead > 0 || tree.behind > 0) && <Chip>{`↑${tree.ahead} ↓${tree.behind}`}</Chip>}
        {tree.sessions.length > 0 && <Chip>{`${tree.sessions.length} ${tree.sessions.length === 1 ? "session" : "sessions"}`}</Chip>}
      </div>
    </motion.button>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
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

function MovePanel({ tree, all, vm, onMoved }: MovePanelProps) {
  const [settings] = useSettings();
  const [withEnv, setWithEnv] = useState(false);
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
    });
    if (parsed.success) request = parsed.data;
    else reason = "The name or branch has characters the VM path can't use.";
  }

  const steps = planMove({ direction, branch: tree.branch ?? "", modified: tree.modified, sessions: tree.sessions.length, includeEnv: withEnv, hasEnv: tree.hasEnv });
  const destination = PLACE[direction === "to-vm" ? "vm" : "mac"];

  const run = async () => {
    if (!request) return;
    setRunning(true);
    setResult(null);
    setProgress({});
    const stop = window.api.onMoveProgress((event) => setProgress((previous) => ({ ...previous, [event.step]: event })));
    try {
      setResult(await window.api.startMove(request));
    } catch {
      setResult({ ok: false, error: "The move couldn't start.", note: null, vmPath: null });
    } finally {
      stop();
      setRunning(false);
      onMoved();
    }
  };

  const openTerminal = (mode: "shell" | "claude") => {
    if (vmTree) void window.api.openVmTerminal({ target, path: vmTree.path, mode });
  };

  const canOpen = vmTree !== null && vm?.reachable === true;
  const claudeMissing = vm?.health?.claudeInstalled === false;

  return (
    <div className="mt-auto shrink-0 pt-4">
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
      <div className="mb-1 text-xs text-[var(--text-secondary)]">{direction === "to-vm" ? "Move to the VM" : "Bring back to the Mac"}</div>
      {direction === "to-vm" && tree.hasEnv && <ToggleRow label="Include .env files" hint="Secrets stay behind unless you opt in." checked={withEnv} onChange={setWithEnv} disabled={running} />}
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
        {running ? "Moving…" : `Move to the ${destination}`}
      </Button>
      {reason && <p className="mt-2 text-center text-[11px] text-[var(--text-muted)]">{reason}</p>}
    </div>
  );
}

export function WorktreesView() {
  const queryClient = useQueryClient();
  const { worktrees, mac, vm } = useWorktrees();
  const icons = useProjectIcons().data ?? {};
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (selectedId !== null && !worktrees.some((tree) => tree.id === selectedId)) setSelectedId(null);
  }, [selectedId, worktrees]);

  const needle = query.trim().toLowerCase();
  const visible = worktrees.filter(
    (tree) => (filter === "all" || tree.location === filter) && (needle === "" || `${tree.name} ${tree.branch ?? ""} ${tree.repo}`.toLowerCase().includes(needle)),
  );
  const selected = visible.find((tree) => tree.id === selectedId) ?? visible[0] ?? null;
  const vmProblem = vm.data && !vm.data.reachable ? vm.data.error : null;

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["mac-worktrees"] });
    void queryClient.invalidateQueries({ queryKey: ["vm-snapshot"] });
  };

  return (
    <div className="grid h-full grid-cols-12 gap-3">
      <Tile
        className="col-span-7"
        title="Worktrees"
        action={
          <div className="flex items-center gap-2">
            <Pill>{String(visible.length)}</Pill>
            <Segmented id="worktree-filter" label="Location" options={FILTERS} value={filter} onChange={setFilter} />
          </div>
        }
      >
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name, branch or repository" aria-label="Search worktrees" className={`${FIELD} mb-3 !py-2 placeholder:text-[var(--text-muted)]`} />
        {vmProblem && (
          <div className="mb-3 flex items-start justify-between gap-3 rounded-xl bg-[var(--inset)] px-3 py-2">
            <span className="text-xs text-[var(--warn)]">{`VM: ${vmProblem}`}</span>
            {vm.data?.approvalUrl ? <ApproveSshButton url={vm.data.approvalUrl} className="max-w-[55%] shrink-0 justify-end" /> : <ConnectTailscaleButton className="max-w-[55%] shrink-0 justify-end" />}
          </div>
        )}
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
          {mac.isPending && <p className="text-xs text-[var(--text-muted)]">Reading your worktrees…</p>}
          {visible.map((tree, i) => (
            <Row key={tree.id} tree={tree} icon={icons[tree.repo]?.icon} index={i} selected={tree.id === selected?.id} hasTwin={counterpartOf(tree, worktrees) !== null} onSelect={() => setSelectedId(tree.id)} />
          ))}
          {!mac.isPending && visible.length === 0 && <p className="text-xs text-[var(--text-muted)]">{needle === "" ? "No worktrees found. Add repositories in Settings." : "Nothing matches that search."}</p>}
        </div>
      </Tile>
      <Tile className="col-span-5" tone="light" index={1} title="Selected" action={selected && <Pill>{PLACE[selected.location]}</Pill>}>
        {selected ? (
          <div key={selected.id} className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            <div className="flex shrink-0 items-center gap-3">
              <ProjectIconEditor repo={selected.repo} info={icons[selected.repo]} />
              <div className="min-w-0 truncate text-3xl font-medium leading-tight">{selected.name}</div>
            </div>
            <div className="mt-1 shrink-0 truncate text-xs text-[var(--text-secondary)]" title={selected.path}>
              {selected.path}
            </div>
            <div className="mt-4 grid shrink-0 grid-cols-3 gap-2">
              <Stat label="Modified" value={String(selected.modified)} />
              <Stat label="Ahead · behind" value={`${selected.ahead} · ${selected.behind}`} />
              <Stat label="Last active" value={timeAgo(selected.lastActive).replace(" ago", "")} />
            </div>
            <div className="mb-1.5 mt-4 shrink-0 text-xs text-[var(--text-secondary)]">Claude sessions</div>
            <div className="max-h-32 shrink-0 space-y-1.5 overflow-y-auto">
              {selected.sessions.length === 0 && <p className="text-xs text-[var(--text-muted)]">No sessions for this worktree.</p>}
              {selected.sessions.map((session) => (
                <div key={session.id} className="flex items-center justify-between gap-3 rounded-xl bg-[var(--inset)] px-3 py-2">
                  <span className="truncate">{session.title}</span>
                  <span className="shrink-0 text-[11px] text-[var(--text-secondary)]">{`${session.messages} lines · ${timeAgo(session.lastActive)}`}</span>
                </div>
              ))}
            </div>
            <MovePanel key={selected.id} tree={selected} all={worktrees} vm={vm.data} onMoved={refresh} />
          </div>
        ) : (
          <p className="text-xs text-[var(--text-muted)]">Select a worktree to see its sessions and move it.</p>
        )}
      </Tile>
    </div>
  );
}
