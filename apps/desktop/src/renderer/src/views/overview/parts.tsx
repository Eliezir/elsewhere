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
