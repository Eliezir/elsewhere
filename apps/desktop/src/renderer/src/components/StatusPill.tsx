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
  const health = connection.health;

  return (
    <div className="flex items-center gap-2 whitespace-nowrap rounded-full border border-[var(--hairline)] bg-[var(--glass)] px-3 py-1.5">
      <span className={`size-2 rounded-full transition-colors duration-300 ${DOT[health]}`} />
      <span>adt-dev</span>
      <span className="text-[var(--text-secondary)]">{LABEL[health]}</span>
      <ConnectTailscaleButton compact bare />
    </div>
  );
}
