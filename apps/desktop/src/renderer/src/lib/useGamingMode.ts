import { useEffect, useState } from "react";
import { useVmSnapshot } from "@/data/hooks";
import { activeOf } from "./hosts";
import { useSettings } from "./settings";

const KEY = "vmc:pc-mode";

type Mode = "dev" | "gaming";

export type GamingStep = { kind: "idle" } | { kind: "confirm" } | { kind: "working" } | { kind: "busy"; reason: string } | { kind: "error"; message: string };

function loadMode(): Mode {
  try {
    return localStorage.getItem(KEY) === "gaming" ? "gaming" : "dev";
  } catch {
    return "dev";
  }
}

function saveMode(mode: Mode): void {
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    return;
  }
}

export function useGamingMode() {
  const [settings] = useSettings();
  const profile = activeOf(settings);
  const snapshot = useVmSnapshot();
  const reachable = snapshot.data?.reachable === true;
  const [mode, setMode] = useState<Mode>(loadMode);
  const [step, setStep] = useState<GamingStep>({ kind: "idle" });

  useEffect(() => {
    if (!reachable || mode === "dev") return;
    saveMode("dev");
    setMode("dev");
  }, [reachable, mode]);

  const start = async (force: boolean) => {
    setStep({ kind: "working" });
    const result = await window.api.startGamingMode({ target: { host: profile.host.trim(), user: profile.user.trim() }, force });
    if (result.ok) {
      saveMode("gaming");
      setMode("gaming");
      setStep({ kind: "idle" });
    } else if (result.busy) {
      setStep({ kind: "busy", reason: result.reason ?? "something is running" });
    } else {
      setStep({ kind: "error", message: result.error ?? "Couldn't start gaming mode." });
    }
  };

  return { profile, reachable, gaming: mode === "gaming" && !reachable, step, setStep, start };
}
