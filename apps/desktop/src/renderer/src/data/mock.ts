import type { IdleHealth, PacerStatus, QueueTask, UsageData, VmHealth, Worktree } from "./types";

export const IS_SAMPLE_DATA = true;

export const REPOS = ["adt-studio", "vm-companion", "claude-companion"] as const;

export const SAMPLE_WORKTREES: readonly Worktree[] = [
  {
    id: "mac-dev-port-conflicts",
    name: "dev-port-conflicts",
    branch: "eliezir/dev-port-conflicts",
    location: "mac",
    path: "~/conductor/workspaces/adt-studio/dev-port-conflicts",
    modified: 1,
    ahead: 3,
    behind: 0,
    lastActive: "12 min ago",
    sessions: [
      { id: "s1", title: "Fix dev server port conflicts across worktrees", messages: 84, lastActive: "12 min ago" },
      { id: "s2", title: "Workspace name handling in dev", messages: 31, lastActive: "2 h ago" },
    ],
    hasEnv: true,
    largeDir: null,
  },
  {
    id: "mac-kids-mode",
    name: "kids-mode",
    branch: "eliezir/kids-mode-ui",
    location: "mac",
    path: "~/conductor/workspaces/adt-studio/kids-mode",
    modified: 0,
    ahead: 0,
    behind: 4,
    lastActive: "yesterday",
    sessions: [{ id: "s3", title: "Layered SVG buddies and roster", messages: 212, lastActive: "yesterday" }],
    hasEnv: true,
    largeDir: { name: "books/", size: "1.2 GB" },
  },
  {
    id: "mac-landing-v3",
    name: "landing-v3",
    branch: "eliezir/landing-page-v3",
    location: "mac",
    path: "~/conductor/workspaces/adt-studio/landing-v3",
    modified: 4,
    ahead: 2,
    behind: 1,
    lastActive: "3 days ago",
    sessions: [
      { id: "s4", title: "Wise-style nav sheets", messages: 57, lastActive: "3 days ago" },
      { id: "s5", title: "Hero animation settle", messages: 22, lastActive: "4 days ago" },
      { id: "s6", title: "Real screenshots pass", messages: 40, lastActive: "5 days ago" },
    ],
    hasEnv: false,
    largeDir: null,
  },
  {
    id: "vm-adt-studio",
    name: "adt-studio",
    branch: "develop",
    location: "vm",
    path: "~/Developer/adt-studio",
    modified: 0,
    ahead: 0,
    behind: 0,
    lastActive: "6 h ago",
    sessions: [{ id: "s7", title: "Review translation gaps", messages: 19, lastActive: "6 h ago" }],
    hasEnv: false,
    largeDir: null,
  },
];

export const SAMPLE_USAGE: UsageData = {
  fiveHour: 22,
  fiveHourResets: "1h 56m",
  weekly: 36,
  weeklyResets: "1d 19h",
  unused: 28,
  fiveHourSeries: [1, 2, 4, 6, 7, 9, 11, 13, 14, 16, 18, 19, 20, 21, 22],
  byModel: [
    { name: "Fable", percent: 24 },
    { name: "Opus", percent: 31 },
    { name: "Sonnet", percent: 12 },
    { name: "Haiku", percent: 3 },
  ],
  days: [
    { day: "Thu", percent: 62 },
    { day: "Fri", percent: 48 },
    { day: "Sat", percent: 12 },
    { day: "Sun", percent: 8 },
    { day: "Mon", percent: 71 },
    { day: "Tue", percent: 55 },
    { day: "Wed", percent: 36 },
  ],
};

export const SAMPLE_VM: VmHealth = {
  cpu: 18,
  cores: 2,
  memUsedGb: 1.2,
  memTotalGb: 11,
  diskUsedGb: 6,
  diskTotalGb: 96,
  load12h: [14, 12, 16, 22, 18, 30, 52, 44, 26, 20, 18, 24, 38, 61, 48, 32, 22, 18, 16, 20, 28, 24, 18, 18],
  latencyMs: 38,
};

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
