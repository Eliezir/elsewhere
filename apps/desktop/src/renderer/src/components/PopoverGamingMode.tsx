import { HoldButton } from "@/components/HoldButton";
import { useGamingMode } from "@/lib/useGamingMode";

export function PopoverGamingMode() {
  const { profile, reachable, gaming, step, setStep, start } = useGamingMode();

  if (gaming) {
    return <p className="text-xs leading-snug text-[var(--text-secondary)]">{`Dev tools are stopped on ${profile.name}. It goes back to dev mode when the PC is turned on again.`}</p>;
  }

  if (step.kind === "working") return <p className="text-xs text-[var(--text-secondary)]">Stopping dev tools…</p>;

  const busy = step.kind === "busy";

  return (
    <div className="space-y-2">
      <p className="text-xs leading-snug text-[var(--text-secondary)]">
        {busy ? `Still running: ${step.reason}. Stopping now cuts it off.` : `Stops Lan Mouse and WSL on ${profile.name} to free memory for games. You lose remote access until the PC is turned on again.`}
      </p>
      <div className="flex items-center gap-2">
        <HoldButton onConfirm={() => void start(busy)} disabled={!reachable} holdingLabel="Keep holding…" className="!px-3 !py-1 text-xs">
          {busy ? "Hold to stop anyway" : "Hold to start gaming mode"}
        </HoldButton>
        {busy && (
          <button type="button" onClick={() => setStep({ kind: "idle" })} className="no-drag cursor-default text-xs text-[var(--text-secondary)] outline-none transition-colors duration-200 hover:text-[var(--text-primary)]">
            Cancel
          </button>
        )}
      </div>
      {step.kind === "error" && <p className="text-xs text-[var(--warn)]">{step.message}</p>}
    </div>
  );
}
