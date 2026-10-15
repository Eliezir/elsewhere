export type { ClaudeSession, Location, VmHealth, VmSnapshot, Worktree } from "@vmc/shared";

export interface DayUsage {
  day: string;
  percent: number;
  hasData: boolean;
}

export interface ScopedUsage {
  id: string;
  title: string;
  percent: number;
  resets: string;
}

export interface UsageSource {
  kind: "oauth" | "statusline" | "none";
  error: string | null;
}

export interface UsageData {
  fiveHour: number | null;
  fiveHourResets: string | null;
  weekly: number | null;
  weeklyResets: string | null;
  unused: number | null;
  days: readonly DayUsage[];
  fiveHourSeries: readonly number[];
  updatedAt: number | null;
  ageMinutes: number | null;
  stale: boolean;
  sampleCount: number;
  scoped: readonly ScopedUsage[];
  source: UsageSource;
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
