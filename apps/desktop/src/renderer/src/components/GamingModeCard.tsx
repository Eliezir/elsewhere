import { Button } from "@/components/controls";
import { Pill, Tile } from "@/components/Tile";
import { useGamingMode } from "@/lib/useGamingMode";

export function GamingModeCard() {
  const { profile, reachable, gaming, step, setStep, start } = useGamingMode();

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
