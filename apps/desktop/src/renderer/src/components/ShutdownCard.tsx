import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { SliderRow, ToggleRow } from "@/components/controls";
import { Pill, Tile } from "@/components/Tile";
import { useShutdownStatus } from "@/data/hooks";
import { activeOf } from "@/lib/hosts";
import { useSettings } from "@/lib/settings";

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

  const apply = async (enable: boolean) => {
    setBusy(true);
    setError(null);
    const result = enable
      ? await window.api.armShutdown({ target, idleMinutes: settings.shutdownIdle, graceSeconds: settings.shutdownGrace })
      : await window.api.disarmShutdown({ target });
    setBusy(false);
    if (!result.reachable) setError(result.error ?? "Couldn't reach the host.");
    queryClient.setQueryData(["shutdown-status", target.host, target.user], result);
  };

  const pill =
    state === "counting-down" ? `Shutting down in ${clock(status.data?.secondsLeft ?? 0)}` : state === "watching" ? `Watching · idle ${status.data?.idleForMinutes ?? 0} min` : "Off";

  return (
    <Tile className="col-span-6" index={index} title={`Shut down ${profile.name} when idle`} action={<Pill tone={state === "counting-down" ? "warn" : armed ? "ok" : "neutral"}>{pill}</Pill>}>
      <ToggleRow
        label="Shut down when nothing is running"
        hint={canWake ? "Powers the PC off completely once no agent has written anything and nothing is building. Wake brings it back." : "Save this host's MAC address first, otherwise you couldn't wake it again from here."}
        checked={armed}
        disabled={busy || (!canWake && !armed) || status.data?.reachable === false}
        onChange={(checked) => void apply(checked)}
      />
      <SliderRow label="Idle for" hint="How long with no agent activity, no build and low load" value={settings.shutdownIdle} min={5} max={120} unit=" min" onChange={(value) => update({ shutdownIdle: value })} />
      <SliderRow label="Warning before power off" hint="Windows shows a countdown on the PC. Run shutdown /a there to cancel." value={settings.shutdownGrace} min={30} max={300} unit=" s" onChange={(value) => update({ shutdownGrace: value })} />
      {armed && <p className="mt-2 text-xs text-[var(--text-secondary)]">Changes to the sliders apply the next time you turn this on.</p>}
      {(error ?? status.data?.error) && status.data?.reachable !== true && <p className="mt-2 text-xs text-[var(--warn)]">{error ?? status.data?.error}</p>}
    </Tile>
  );
}
