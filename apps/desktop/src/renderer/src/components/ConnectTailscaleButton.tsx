import { useTailscaleControl } from "@/lib/tailscale";
import { Button } from "./controls";

export function ConnectTailscaleButton({ className = "" }: { className?: string }) {
  const { connected, needsLogin, busy, message, connect } = useTailscaleControl();
  if (connected) return null;

  const label = busy ? "Connecting…" : needsLogin ? "Sign in to Tailscale" : "Connect Tailscale";
  return (
    <span className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 ${className}`}>
      <Button onClick={connect} disabled={busy} className="!px-3 !py-1 text-xs whitespace-nowrap">
        {label}
      </Button>
      {message && <span className="basis-full text-[11px] leading-snug text-[var(--warn)]">{message}</span>}
    </span>
  );
}
