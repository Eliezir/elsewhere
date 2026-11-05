import { useEffect, useState } from "react";
import { Button } from "@/components/controls";
import { useVmSnapshot } from "@/data/hooks";

const WAIT_MS = 120000;
const POLL_MS = 4000;

type Phase = { kind: "idle" } | { kind: "waiting"; since: number } | { kind: "error"; message: string };

export function WakeButton({ mac }: { mac: string }) {
  const vm = useVmSnapshot();
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [now, setNow] = useState(() => Date.now());
  const reachable = vm.data?.reachable === true;
  const { refetch } = vm;

  useEffect(() => {
    if (phase.kind !== "waiting") return;
    const timer = window.setInterval(() => {
      setNow(Date.now());
      void refetch();
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [phase, refetch]);

  useEffect(() => {
    if (phase.kind !== "waiting") return;
    if (reachable) setPhase({ kind: "idle" });
    else if (now - phase.since > WAIT_MS) setPhase({ kind: "error", message: "It didn't come up. Check that Wake-on-LAN is on and the PC is on this network." });
  }, [phase, reachable, now]);

  const wake = async () => {
    const result = await window.api.wakeHost({ mac: mac.trim() });
    if (!result.ok) {
      setPhase({ kind: "error", message: result.error ?? "Couldn't send the wake packet." });
      return;
    }
    setNow(Date.now());
    setPhase({ kind: "waiting", since: Date.now() });
  };

  const waiting = phase.kind === "waiting";
  const seconds = waiting ? Math.max(0, Math.round((now - phase.since) / 1000)) : 0;
  const validMac = /^([0-9a-fA-F]{2}[:-]){5}[0-9a-fA-F]{2}$/.test(mac.trim());

  return (
    <div className="flex flex-col gap-1">
      <Button onClick={() => void wake()} disabled={!validMac || waiting || reachable}>
        {reachable ? "Awake" : waiting ? `Waking… ${seconds}s` : "Wake"}
      </Button>
      {phase.kind === "error" && <p className="max-w-56 text-[11px] leading-snug text-[var(--warn)]">{phase.message}</p>}
    </div>
  );
}
