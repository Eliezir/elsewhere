import type { IdleHealth, PacerStatus, QueueTask } from "./types";

export const IS_SAMPLE_DATA = true;

export const REPOS = ["adt-studio", "vm-companion", "claude-companion"] as const;

export const SAMPLE_IDLE: IdleHealth = {
  sevenDayCpu: 34,
  threshold: 20,
  days: [0, 1, 0, 0, 1, 0, 0],
  atRisk: false,
};

export const SAMPLE_TASKS: readonly QueueTask[] = [
  {
    id: "t1",
    title: "Review translation gaps",
    repo: "adt-studio",
    branch: "agent/translation-gaps",
    state: "running",
    priority: "normal",
    estimate: "~25 min",
    detail: "Read-only agent. Results arrive as a patch and a summary.",
    log: ["12:04 Created worktree agent/translation-gaps", "12:05 Scanning es.po, fr.po, pt-BR.po", "12:11 3 catalogs checked, 41 gaps found", "12:16 Drafting fixes for pt-BR"],
  },
  {
    id: "t2",
    title: "Fix typecheck in landing page",
    repo: "adt-studio",
    branch: "agent/landing-typecheck",
    state: "waiting",
    priority: "high",
    estimate: "~10 min",
    detail: "Waits until the 5-hour window drops under the pacer cap.",
    log: [],
  },
  {
    id: "t3",
    title: "Sync docs with the API",
    repo: "adt-studio",
    branch: "agent/docs-sync",
    state: "waiting",
    priority: "low",
    estimate: "~40 min",
    detail: "Runs when the weekly allowance is about to reset unused.",
    log: [],
  },
  {
    id: "t4",
    title: "Add tests for the Tailscale parser",
    repo: "vm-companion",
    branch: "agent/tailscale-tests",
    state: "done",
    priority: "normal",
    estimate: "took 14 min",
    detail: "3 local commits and a summary report. Nothing was pushed.",
    log: ["21:40 Created worktree agent/tailscale-tests", "21:48 Added 6 cases", "21:54 Committed 3 changes"],
  },
  {
    id: "t5",
    title: "Upgrade Lingui to the next minor",
    repo: "adt-studio",
    branch: "agent/lingui-upgrade",
    state: "failed",
    priority: "low",
    estimate: "stopped after 6 min",
    detail: "The lockfile conflicted with develop. Retry after a rebase.",
    log: ["20:02 Created worktree agent/lingui-upgrade", "20:06 pnpm install failed: lockfile conflict", "20:08 Stopped"],
  },
];

export const SAMPLE_PACER: PacerStatus = {
  releasing: true,
  reason: "The 5-hour window is under the cap and the week has unused allowance.",
};
