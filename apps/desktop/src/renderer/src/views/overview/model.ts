import { useIdleHealth, useQueueTasks, useUsage, useVmHealth, useWorktrees } from "@/data/hooks";
import type { IdleHealth, Location, UsageData, VmHealth } from "@/data/types";
import { useTailscaleStatus } from "@/lib/queries";
import { describe, healthOf, type Health } from "@/lib/status";

export interface ConnectionModel {
  health: Health;
  headline: string;
  selfName: string | null;
  dnsName: string | null;
  ip: string | null;
  latencyMs: number | null;
}

export interface WorktreeModel {
  name: string;
  detail: string;
  location: Location;
}

export interface JobModel {
  title: string;
  state: "running" | "waiting";
  detail: string;
}

export interface OverviewModel {
  phase: "loading" | "ready";
  connection: ConnectionModel;
  usage: UsageData | null;
  vm: VmHealth | null;
  idle: IdleHealth | null;
  worktrees: readonly WorktreeModel[];
  queue: readonly JobModel[];
}

export function useOverviewModel(): OverviewModel {
  const { data: status } = useTailscaleStatus();
  const { data: usage } = useUsage();
  const { data: vm } = useVmHealth();
  const { data: idle } = useIdleHealth();
  const { data: trees = [] } = useWorktrees();
  const { data: tasks = [] } = useQueueTasks();

  const health = healthOf(status);
  const reachable = health === "ok";

  return {
    phase: status === undefined ? "loading" : "ready",
    connection: {
      health,
      headline: describe(status),
      selfName: status?.selfName ?? null,
      dnsName: status?.vm?.dnsName ?? null,
      ip: status?.vm?.ip ?? null,
      latencyMs: reachable ? (vm?.latencyMs ?? null) : null,
    },
    usage: usage ?? null,
    vm: reachable ? (vm ?? null) : null,
    idle: reachable ? (idle ?? null) : null,
    worktrees: trees
      .filter((tree) => reachable || tree.location === "mac")
      .map((tree) => ({
        name: tree.name,
        detail: `${tree.branch} · ${tree.modified > 0 ? `${tree.modified} modified` : "clean"}`,
        location: tree.location,
      })),
    queue: reachable
      ? tasks
          .filter((task) => task.state === "running" || task.state === "waiting")
          .map((task) => ({
            title: task.title,
            state: task.state === "running" ? ("running" as const) : ("waiting" as const),
            detail: task.state === "running" ? `${task.repo} · ${task.estimate}` : "waits for headroom",
          }))
      : [],
  };
}
