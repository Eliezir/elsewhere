import type { PowerAction } from "@vmc/shared";
import { useEffect, useState } from "react";
import { useVmSnapshot } from "@/data/hooks";
import { activeOf } from "./hosts";
import { useSettings } from "./settings";

const GRACE_MS = 90000;
const TICK_MS = 3000;

export type PowerStep = { kind: "idle" } | { kind: "working" } | { kind: "busy"; action: PowerAction; reason: string } | { kind: "error"; message: string };

export const POWER_LABEL: Record<PowerAction, { verb: string; ing: string }> = {
  sleep: { verb: "Sleep", ing: "Going to sleep" },
  shutdown: { verb: "Shut down", ing: "Shutting down" },
  restart: { verb: "Restart", ing: "Restarting" },
};

export function usePower() {
  const [settings] = useSettings();
  const profile = activeOf(settings);
  const snapshot = useVmSnapshot();
  const reachable = snapshot.data?.reachable === true;
  const [step, setStep] = useState<PowerStep>({ kind: "idle" });
  const [pending, setPending] = useState<{ action: PowerAction; at: number } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const { refetch } = snapshot;

  useEffect(() => {
    if (pending === null) return;
    const timer = window.setInterval(() => {
      setNow(Date.now());
      void refetch();
    }, TICK_MS);
    return () => window.clearInterval(timer);
  }, [pending, refetch]);

  useEffect(() => {
    if (pending !== null && now - pending.at >= GRACE_MS) setPending(null);
  }, [pending, now]);

  const run = async (action: PowerAction, force: boolean) => {
    setStep({ kind: "working" });
    const result = await window.api.powerAction({ target: { host: profile.host.trim(), user: profile.user.trim() }, action, force });
    if (result.ok) {
      setPending({ action, at: Date.now() });
      setNow(Date.now());
      setStep({ kind: "idle" });
    } else if (result.busy) {
      setStep({ kind: "busy", action, reason: result.reason ?? "something is running" });
    } else {
      setStep({ kind: "error", message: result.error ?? "That didn't work." });
    }
  };

  const going = pending !== null && reachable ? pending.action : null;
  const away = !reachable && pending !== null ? pending.action : null;

  return { profile, reachable, step, setStep, run, going, away };
}
