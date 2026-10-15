export type Location = "mac" | "vm";

export interface ClaudeSession {
  id: string;
  title: string;
  messages: number;
  lastActive: string;
}

export interface Worktree {
  id: string;
  name: string;
  branch: string;
  location: Location;
  path: string;
  modified: number;
  ahead: number;
  behind: number;
  lastActive: string;
  sessions: readonly ClaudeSession[];
  hasEnv: boolean;
  largeDir: { name: string; size: string } | null;
}

export interface ModelUsage {
  name: string;
  percent: number;
}

export interface DayUsage {
  day: string;
  percent: number;
}

export interface UsageData {
  fiveHour: number;
  fiveHourResets: string;
  weekly: number;
  weeklyResets: string;
  unused: number;
  byModel: readonly ModelUsage[];
  days: readonly DayUsage[];
  fiveHourSeries: readonly number[];
}

export interface VmHealth {
  cpu: number;
  cores: number;
  memUsedGb: number;
  memTotalGb: number;
  diskUsedGb: number;
  diskTotalGb: number;
  load12h: readonly number[];
  latencyMs: number;
}

export interface IdleHealth {
  sevenDayCpu: number;
  threshold: number;
  days: readonly number[];
  atRisk: boolean;
}

export type TaskState = "running" | "waiting" | "done" | "failed" | "cancelled";
export type Priority = "low" | "normal" | "high";

export interface QueueTask {
  id: string;
  title: string;
  repo: string;
  branch: string;
  state: TaskState;
  priority: Priority;
  estimate: string;
  detail: string;
  log: readonly string[];
}

export interface PacerStatus {
  releasing: boolean;
  reason: string;
}
