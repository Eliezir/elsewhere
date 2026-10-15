import type { ReactNode } from "react";
import type { OverviewModel } from "./model";

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-white/[0.07] ${className}`} />;
}

export function Loadable({ model, children, className = "h-full min-h-10 w-full" }: { model: OverviewModel; children: ReactNode; className?: string }) {
  return model.phase === "loading" ? <Skeleton className={className} /> : <>{children}</>;
}

export function Unavailable({ model, what }: { model: OverviewModel; what: string }) {
  const reason =
    model.connection.health === "down" || model.connection.health === "unknown"
      ? model.connection.headline
      : `${what} isn't available yet`;
  return <p className="text-xs text-[var(--text-muted)]">{reason}.</p>;
}

export function NoUsage() {
  return (
    <p className="text-xs leading-relaxed text-[var(--text-muted)]">
      Waiting for a Claude Code session. Limits appear after its first reply, once the status-line recorder is installed.
    </p>
  );
}

export function headlineFor(model: OverviewModel): string {
  const { connection, usage, idle } = model;
  if (connection.health === "down") return connection.headline.toUpperCase() + ".";
  if (connection.health === "warn") return "THE VM ISN'T ON YOUR TAILNET.";
  if (idle?.atRisk) return "YOUR VM IS NEARLY IDLE. ORACLE MAY RECLAIM IT.";
  if (usage && usage.weekly !== null) return `YOUR VM IS AWAKE. ${100 - usage.weekly}% OF THE WEEK IS STILL FREE.`;
  return "YOUR VM IS AWAKE.";
}
