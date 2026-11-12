import { useHostName } from "@/lib/useHost";
import { useWorktrees } from "@/data/hooks";
import type { Location, VmHealth } from "@/data/types";
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
  repo: string;
  detail: string;
  location: Location;
}

export interface OverviewModel {
  phase: "loading" | "ready";
  connection: ConnectionModel;
  vm: VmHealth | null;
  worktrees: readonly WorktreeModel[];
}

export function useOverviewModel(): OverviewModel {
  const { data: status } = useTailscaleStatus();
  const { worktrees: trees, vm: snapshot } = useWorktrees();

  const host = useHostName();
  const health = healthOf(status);
  const vm = snapshot.data;

  return {
    phase: status === undefined ? "loading" : "ready",
    connection: {
      health,
      headline: describe(status, host),
      selfName: status?.selfName ?? null,
      dnsName: status?.vm?.dnsName ?? null,
      ip: status?.vm?.ip ?? null,
      latencyMs: vm?.latencyMs ?? null,
    },
    vm: vm?.health ?? null,
    worktrees: trees.map((tree) => ({
        name: tree.name,
        repo: tree.repo,
        detail: `${tree.branch ?? "detached"} · ${tree.modified > 0 ? `${tree.modified} modified` : "clean"}`,
        location: tree.location,
      })),
  };
}
