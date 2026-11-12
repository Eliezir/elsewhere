import type { PowerAction } from "@vmc/shared";
import { HoldButton } from "@/components/HoldButton";
import { WakeButton } from "@/components/WakeButton";
import { POWER_LABEL, usePower } from "@/lib/usePower";

const ACTIONS: readonly PowerAction[] = ["sleep", "shutdown", "restart"];

export function PowerControls({ compact = false }: { compact?: boolean }) {
  const { profile, reachable, step, setStep, run, going, away } = usePower();
  const hasMac = profile.mac.trim() !== "";
  const button = compact ? "!px-3 !py-1 text-xs" : "!px-3.5 !py-1.5 text-sm";

  if (!reachable) {
    return (
      <div className="space-y-2">
        <p className="text-xs leading-snug text-[var(--text-secondary)]">
          {away ? `${profile.name} is ${away === "sleep" ? "asleep" : away === "restart" ? "restarting" : "off"}.` : `${profile.name} isn't reachable.`}
          {hasMac ? " Wake it from here when you need it." : " Add its MAC address in Settings to wake it from here."}
        </p>
        {hasMac && <WakeButton mac={profile.mac} />}
      </div>
    );
  }

  if (going !== null) return <p className="text-xs leading-snug text-[var(--text-secondary)]">{`${POWER_LABEL[going].ing}… ${profile.name} goes offline shortly.`}</p>;
  if (step.kind === "working") return <p className="text-xs text-[var(--text-secondary)]">Sending the command…</p>;

  const busy = step.kind === "busy" ? step : null;

  return (
    <div className="space-y-2">
      <p className={`text-xs leading-snug ${step.kind === "error" ? "text-[var(--warn)]" : "text-[var(--text-secondary)]"}`}>
        {busy ? `Still running: ${busy.reason}. Doing this now cuts it off.` : step.kind === "error" ? step.message : "Hold a button to confirm. Shut down and restart give a 30 second warning on the PC."}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {(busy ? [busy.action] : ACTIONS).map((action) => (
          <HoldButton key={action} onConfirm={() => void run(action, busy !== null)} holdingLabel="Keep holding…" className={button}>
            {busy ? `Hold to ${POWER_LABEL[action].verb.toLowerCase()} anyway` : POWER_LABEL[action].verb}
          </HoldButton>
        ))}
        {busy && (
          <button type="button" onClick={() => setStep({ kind: "idle" })} className="no-drag cursor-default text-xs text-[var(--text-secondary)] outline-none transition-colors duration-200 hover:text-[var(--text-primary)]">
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
