import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Segmented, SliderRow, ToggleRow } from "@/components/controls";
import { Pill, Tile } from "@/components/Tile";
import { useShutdownStatus } from "@/data/hooks";
import { activeOf } from "@/lib/hosts";
import { useSettings } from "@/lib/settings";

const MODES = [
  { value: "shutdown", label: "Shut down" },
  { value: "sleep", label: "Sleep" },
] as const;

const MAC_PATTERN = /^([0-9a-fA-F]{2}[:-]){5}[0-9a-fA-F]{2}$/;

function clock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function ShutdownCard({ index }: { index: number }) {
  const [settings, update] = useSettings();
  const profile = activeOf(settings);
  const target = { host: profile.host.trim(), user: profile.user.trim() };
  const status = useShutdownStatus(profile.host, profile.user);
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const state = status.data?.state ?? "off";
  const canWake = MAC_PATTERN.test(profile.mac.trim());
  const armed = state !== "off";
  const mode = armed ? (status.data?.action ?? settings.shutdownMode) : settings.shutdownMode;
  const sleeping = mode === "sleep";

  const apply = async (enable: boolean) => {
    setBusy(true);
    setError(null);
    const result = enable
      ? await window.api.armShutdown({ target, idleMinutes: settings.shutdownIdle, graceSeconds: settings.shutdownGrace, action: settings.shutdownMode })
      : await window.api.disarmShutdown({ target });
    setBusy(false);
    if (!result.reachable) setError(result.error ?? "Couldn't reach the host.");
    queryClient.setQueryData(["shutdown-status", target.host, target.user], result);
  };

  const pill =
    state === "counting-down" ? `${sleeping ? "Sleeping" : "Shutting down"} in ${clock(status.data?.secondsLeft ?? 0)}` : state === "watching" ? `Watching · idle ${status.data?.idleForMinutes ?? 0} min` : "Off";

  return (
    <Tile className="col-span-6" index={index} title={`${sleeping ? "Sleep" : "Shut down"} ${profile.name} when idle`} action={<Pill tone={state === "counting-down" ? "warn" : armed ? "ok" : "neutral"}>{pill}</Pill>}>
      <div className="pb-2">
        <Segmented id="idle-mode" label="When idle" options={MODES} value={settings.shutdownMode} onChange={(value) => update({ shutdownMode: value })} />
      </div>
      <ToggleRow
        label={sleeping ? "Sleep when nothing is running" : "Shut down when nothing is running"}
        hint={
          canWake
            ? sleeping
              ? "Puts the PC to sleep once no agent has written anything and nothing is building. It wakes faster than a full start, and new activity during the warning cancels it."
              : "Powers the PC off completely once no agent has written anything and nothing is building. Wake brings it back."
            : "Save this host's MAC address first, otherwise you couldn't wake it again from here."
        }
        checked={armed}
        disabled={busy || (!canWake && !armed) || status.data?.reachable === false}
        onChange={(checked) => void apply(checked)}
      />
      <SliderRow label="Idle for" hint="How long with no agent activity, no build and low load" value={settings.shutdownIdle} min={5} max={120} unit=" min" onChange={(value) => update({ shutdownIdle: value })} />
      <SliderRow label={sleeping ? "Warning before sleep" : "Warning before power off"} hint={sleeping ? "If an agent or build starts during this time, it stays awake." : "Windows shows a countdown on the PC. Run shutdown /a there to cancel."} value={settings.shutdownGrace} min={30} max={300} unit=" s" onChange={(value) => update({ shutdownGrace: value })} />
      {armed && <p className="mt-2 text-xs text-[var(--text-secondary)]">Changes to the sliders apply the next time you turn this on.</p>}
      {(error ?? status.data?.error) && status.data?.reachable !== true && <p className="mt-2 text-xs text-[var(--warn)]">{error ?? status.data?.error}</p>}
    </Tile>
  );
}
