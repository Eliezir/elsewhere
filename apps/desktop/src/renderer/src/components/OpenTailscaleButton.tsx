import { useTailscaleControl } from "@/lib/tailscale";
import { Button } from "./controls";

export function OpenTailscaleButton({ className = "" }: { className?: string }) {
  const { connected, needsLogin, busy, message, connect } = useTailscaleControl();
  if (connected) return null;

  const label = busy ? "Connecting…" : needsLogin ? "Sign in to Tailscale" : "Connect Tailscale";
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <Button onClick={connect} disabled={busy} className="!px-3 !py-1 text-xs">
        {label}
      </Button>
      {message && <span className="max-w-[240px] text-[11px] leading-snug text-[var(--warn)]">{message}</span>}
    </span>
  );
}
