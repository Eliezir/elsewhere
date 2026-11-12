import { useEffect, useState } from "react";
import { useLinkStatus } from "@/data/hooks";
import { activeOf } from "./hosts";
import { useSettings } from "./settings";

const KEY = "vmc:pc-mode";
const GRACE_MS = 90000;
const TICK_MS = 3000;

type Mode = "dev" | "gaming";

interface Saved {
  mode: Mode;
  at: number;
}

export type GamingStep = { kind: "idle" } | { kind: "confirm" } | { kind: "working" } | { kind: "busy"; reason: string } | { kind: "error"; message: string };

function load(): Saved {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === "gaming") return { mode: "gaming", at: 0 };
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (typeof parsed === "object" && parsed !== null && (parsed as Saved).mode === "gaming") return { mode: "gaming", at: Number((parsed as Saved).at) || 0 };
  } catch {
    return { mode: "dev", at: 0 };
  }
  return { mode: "dev", at: 0 };
}

function save(value: Saved): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    return;
  }
}

export function useGamingMode() {
  const [settings] = useSettings();
  const profile = activeOf(settings);
  const link = useLinkStatus();
  const reachable = link.state === "ok";
  const [saved, setSaved] = useState<Saved>(load);
  const [step, setStep] = useState<GamingStep>({ kind: "idle" });
  const [now, setNow] = useState(() => Date.now());
  const inGrace = saved.mode === "gaming" && now - saved.at < GRACE_MS;

  useEffect(() => {
    if (saved.mode !== "gaming") return;
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, TICK_MS);
    return () => window.clearInterval(timer);
  }, [saved.mode]);

  useEffect(() => {
    if (saved.mode !== "gaming" || !reachable || inGrace) return;
    const next: Saved = { mode: "dev", at: 0 };
    save(next);
    setSaved(next);
  }, [saved.mode, reachable, inGrace]);

  const start = async (force: boolean) => {
    setStep({ kind: "working" });
    const result = await window.api.startGamingMode({ target: { host: profile.host.trim(), user: profile.user.trim() }, force });
    if (result.ok) {
      const next: Saved = { mode: "gaming", at: Date.now() };
      save(next);
      setSaved(next);
      setNow(Date.now());
      setStep({ kind: "idle" });
    } else if (result.busy) {
      setStep({ kind: "busy", reason: result.reason ?? "something is running" });
    } else {
      setStep({ kind: "error", message: result.error ?? "Couldn't start gaming mode." });
    }
  };

  const gaming = saved.mode === "gaming" && !reachable;
  const stopping = saved.mode === "gaming" && reachable && inGrace;

  return { profile, reachable, gaming, stopping, step, setStep, start };
}
