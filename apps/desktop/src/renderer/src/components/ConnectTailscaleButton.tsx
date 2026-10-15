import { useTailscaleControl } from "@/lib/tailscale";
import { Button } from "./controls";

export function ConnectTailscaleButton({ className = "", compact = false, bare = false }: { className?: string; compact?: boolean; bare?: boolean }) {
  const { connected, needsLogin, busy, message, connect } = useTailscaleControl();
  if (connected) return null;

  const label = busy ? "Connecting…" : needsLogin ? "Sign in to Tailscale" : "Connect Tailscale";
  return (
    <span className={`${compact ? "relative inline-flex" : "flex flex-wrap items-center gap-x-3 gap-y-1.5"} ${className}`}>
      {bare ? (
        <button
          type="button"
          onClick={connect}
          disabled={busy}
          className="no-drag cursor-default whitespace-nowrap rounded-full px-2 py-0.5 text-xs text-[var(--accent)] outline-none transition-colors duration-200 hover:bg-white/10 disabled:text-[var(--text-muted)]"
        >
          {label}
        </button>
      ) : (
        <Button onClick={connect} disabled={busy} className="!px-3 !py-1 text-xs whitespace-nowrap">
          {label}
        </Button>
      )}
      {message && (
        <span
          className={
            compact
              ? "absolute right-0 top-full z-20 mt-2 w-64 rounded-xl border border-[var(--hairline)] bg-[var(--glass-strong)] p-2.5 text-[11px] leading-snug text-[var(--warn)] shadow-lg"
              : "basis-full text-[11px] leading-snug text-[var(--warn)]"
          }
        >
          {message}
        </span>
      )}
    </span>
  );
}
