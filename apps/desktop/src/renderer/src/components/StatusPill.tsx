import { useLinkStatus } from "@/data/hooks";
import { useOverviewModel } from "@/views/overview/model";
import { ConnectTailscaleButton } from "./ConnectTailscaleButton";
import type { Health } from "@/lib/status";

const DOT: Record<Health, string> = {
  ok: "bg-[var(--ok)]",
  warn: "bg-[var(--warn)]",
  down: "bg-[var(--down)]",
  unknown: "bg-[var(--text-muted)]",
};

const LABEL: Record<Health, string> = {
  ok: "online",
  warn: "not on tailnet",
  down: "unreachable",
  unknown: "checking",
};

export function StatusPill() {
  const { connection } = useOverviewModel();
  const link = useLinkStatus();
  const health: Health = link.state === "approval" ? "warn" : link.state === "offline" ? "down" : connection.health;
  const label = link.state === "approval" ? "needs approval" : link.state === "offline" && connection.health === "ok" ? "can't reach VM" : LABEL[health];

  return (
    <div className="flex items-center gap-2 whitespace-nowrap rounded-full border border-[var(--hairline)] bg-[var(--glass)] px-3 py-1.5">
      <span className={`size-2 rounded-full transition-colors duration-300 ${DOT[health]}`} />
      <span>adt-dev</span>
      <span className="text-[var(--text-secondary)]">{label}</span>
      <ConnectTailscaleButton compact bare />
    </div>
  );
}
