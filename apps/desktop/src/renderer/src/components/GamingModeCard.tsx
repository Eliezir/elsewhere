import { useEffect, useState } from "react";
import { Button } from "@/components/controls";
import { Pill, Tile } from "@/components/Tile";
import { useVmSnapshot } from "@/data/hooks";
import { activeOf } from "@/lib/hosts";
import { useSettings } from "@/lib/settings";

const KEY = "vmc:pc-mode";

type Mode = "dev" | "gaming";

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

type Step = { kind: "idle" } | { kind: "confirm" } | { kind: "working" } | { kind: "busy"; reason: string } | { kind: "error"; message: string };

export function GamingModeCard() {
  const [settings] = useSettings();
  const profile = activeOf(settings);
  const snapshot = useVmSnapshot();
  const reachable = snapshot.data?.reachable === true;
  const [mode, setMode] = useState<Mode>(loadMode);
  const [step, setStep] = useState<Step>({ kind: "idle" });

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

  const gaming = mode === "gaming" && !reachable;

  return (
    <Tile index={5} title="PC mode" action={<Pill tone={gaming ? "warn" : "ok"}>{gaming ? "Gaming mode" : "Dev mode"}</Pill>}>
      {gaming ? (
        <p className="text-xs leading-relaxed text-[var(--text-secondary)]">{`Dev tools on ${profile.name} are stopped and its memory is free for games. It goes back to dev mode the next time the PC is turned on, by Alexa or Wake.`}</p>
      ) : step.kind === "confirm" || step.kind === "working" || step.kind === "busy" ? (
        <div className="space-y-2.5">
          <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
            {step.kind === "busy"
              ? `Something is still running: ${step.reason}. Stopping now cuts it off.`
              : `This closes Lan Mouse and stops WSL on ${profile.name}. You lose remote access to it until the PC is turned on again.`}
          </p>
          <div className="flex gap-2">
            <Button variant={step.kind === "busy" ? "danger" : "primary"} disabled={step.kind === "working"} onClick={() => void start(step.kind === "busy")}>
              {step.kind === "working" ? "Stopping…" : step.kind === "busy" ? "Stop anyway" : "Start gaming mode"}
            </Button>
            <Button disabled={step.kind === "working"} onClick={() => setStep({ kind: "idle" })}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          <p className="text-xs leading-relaxed text-[var(--text-secondary)]">{`Dev tools are running on ${profile.name}. Gaming mode removes them to free memory for games.`}</p>
          <Button disabled={!reachable} onClick={() => setStep({ kind: "confirm" })}>
            Gaming mode
          </Button>
          {step.kind === "error" && <p className="text-xs text-[var(--warn)]">{step.message}</p>}
        </div>
      )}
    </Tile>
  );
}
