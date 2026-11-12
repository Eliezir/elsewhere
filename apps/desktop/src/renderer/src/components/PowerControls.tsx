import type { PowerAction } from "@vmc/shared";
import type { ReactNode } from "react";
import { HoldButton } from "@/components/HoldButton";
import { WakeButton } from "@/components/WakeButton";
import { POWER_LABEL, usePower } from "@/lib/usePower";

const ACTIONS: readonly PowerAction[] = ["sleep", "shutdown", "restart"];

const ICON: Record<PowerAction, ReactNode> = {
  sleep: <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z" />,
  shutdown: (
    <>
      <path d="M12 3v8" />
      <path d="M6.3 6.8a8 8 0 1 0 11.4 0" />
    </>
  ),
  restart: (
    <>
      <path d="M20 12a8 8 0 1 1-2.6-5.9" />
      <path d="M20 4v5h-5" />
    </>
  ),
};

function Icon({ action }: { action: PowerAction }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3.5 shrink-0" aria-hidden="true">
      {ICON[action]}
    </svg>
  );
}

export function PowerControls({ compact = false }: { compact?: boolean }) {
  const { profile, reachable, step, setStep, run, going, away } = usePower();
  const hasMac = profile.mac.trim() !== "";
  const note = "text-[11px] leading-snug text-[var(--text-secondary)]";

  if (!reachable) {
    return (
      <div className="space-y-2.5">
        <p className={note}>
          {away ? `${profile.name} is ${away === "sleep" ? "asleep" : away === "restart" ? "restarting" : "off"}.` : `${profile.name} isn't reachable.`}
          {hasMac ? "" : " Add its MAC address in Settings to wake it from here."}
        </p>
        {hasMac && <WakeButton mac={profile.mac} primary />}
      </div>
    );
  }

  if (going !== null) return <p className={note}>{`${POWER_LABEL[going].ing}… ${profile.name} goes offline in a moment.`}</p>;
  if (step.kind === "working") return <p className={note}>Sending the command…</p>;

  const busy = step.kind === "busy" ? step : null;

  if (busy) {
    return (
      <div className="space-y-2.5">
        <p className={note}>{`Still running: ${busy.reason}. Doing this now cuts it off.`}</p>
        <div className="flex items-center gap-3">
          <HoldButton tone="danger" onConfirm={() => void run(busy.action, true)} holdingLabel="Keep holding…" className="!px-3.5 !py-1.5 text-xs">
            {`Hold to ${POWER_LABEL[busy.action].verb.toLowerCase()} anyway`}
          </HoldButton>
          <button type="button" onClick={() => setStep({ kind: "idle" })} className="no-drag cursor-default text-xs text-[var(--text-secondary)] outline-none transition-colors duration-200 hover:text-[var(--text-primary)]">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-3 gap-2">
        {ACTIONS.map((action) => (
          <HoldButton key={action} onConfirm={() => void run(action, false)} holdingLabel="Hold…" className={`!rounded-xl !px-1 text-[11px] ${compact ? "!py-1.5" : "!py-2"}`}>
            <span className="flex flex-col items-center gap-1">
              <Icon action={action} />
              {POWER_LABEL[action].verb}
            </span>
          </HoldButton>
        ))}
      </div>
      <p className={step.kind === "error" ? "text-[11px] leading-snug text-[var(--warn)]" : note}>{step.kind === "error" ? step.message : "Hold a button to confirm. Shut down and restart warn on the PC for 30 s."}</p>
    </div>
  );
}
