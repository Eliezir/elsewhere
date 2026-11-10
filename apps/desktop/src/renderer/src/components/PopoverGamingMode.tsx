import { HoldButton } from "@/components/HoldButton";
import { useGamingMode } from "@/lib/useGamingMode";

export function PopoverGamingMode() {
  const { profile, reachable, gaming, stopping, step, setStep, start } = useGamingMode();
  const busy = step.kind === "busy";
  const working = step.kind === "working";

  const subtitle = gaming
    ? "Stopped. Back to dev when the PC restarts"
    : stopping
      ? "Stopping WSL and Lan Mouse… the PC goes offline shortly"
      : working
      ? "Stopping dev tools…"
      : busy
        ? `Still running: ${step.reason}`
        : step.kind === "error"
          ? step.message
          : "Stops WSL and Lan Mouse until the next boot";

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="leading-tight">{`Gaming mode on ${profile.name}`}</div>
        <div className={`line-clamp-2 text-[11px] leading-tight ${step.kind === "error" ? "text-[var(--warn)]" : "text-[var(--text-secondary)]"}`}>{subtitle}</div>
      </div>
      {!gaming && !stopping && (
        <div className="flex shrink-0 items-center gap-2">
          {busy && (
            <button type="button" onClick={() => setStep({ kind: "idle" })} className="no-drag cursor-default text-xs text-[var(--text-secondary)] outline-none transition-colors duration-200 hover:text-[var(--text-primary)]">
              Cancel
            </button>
          )}
          <HoldButton onConfirm={() => void start(busy)} disabled={!reachable || working} holdingLabel="Keep holding…" className="!px-3 !py-1 text-xs">
            {busy ? "Hold to stop anyway" : "Hold to start"}
          </HoldButton>
        </div>
      )}
    </div>
  );
}
