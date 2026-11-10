import { useQueryClient } from "@tanstack/react-query";
import type { HostAppAction, HostAppState } from "@vmc/shared";
import { useState } from "react";
import { Button, SelectField, ToggleRow } from "@/components/controls";
import { Pill, Tile } from "@/components/Tile";
import { useHostAppStatus, useLanMouse } from "@/data/hooks";
import { activeOf } from "@/lib/hosts";
import { useSettings } from "@/lib/settings";

const LABEL: Record<HostAppState, string> = {
  "not-installed": "Not installed",
  "not-set-up": "Needs setup",
  running: "Running",
  stopped: "Closed",
  started: "Running",
  closed: "Closed",
  failed: "Didn't respond",
};

const RUNNING: readonly HostAppState[] = ["running", "started"];

const DURATIONS = [
  { value: "0", label: "Until I turn it off" },
  { value: "15", label: "For 15 minutes" },
  { value: "30", label: "For 30 minutes" },
  { value: "60", label: "For 1 hour" },
] as const;

function minutesLeft(backAt: number | null, now: number): number | null {
  return backAt === null ? null : Math.max(1, Math.ceil((backAt - now) / 60000));
}

function ShareRow({ host }: { host: string }) {
  const queryClient = useQueryClient();
  const status = useLanMouse();
  const [busy, setBusy] = useState(false);
  const [duration, setDuration] = useState("15");
  const data = status.data;
  const running = data?.running === true;
  const left = minutesLeft(data?.backAt ?? null, Date.now());

  const apply = async (share: boolean) => {
    setBusy(true);
    const minutes = Number(duration);
    const result = await window.api.controlLanMouse(share ? { action: "share", minutes: minutes > 0 ? minutes : null } : { action: "stop" });
    setBusy(false);
    queryClient.setQueryData(["lan-mouse"], result);
  };

  return (
    <div className="border-t border-white/5 pt-2">
      <ToggleRow
        label={`Use this Mac's keyboard and mouse on ${host}`}
        hint={
          !running
            ? "Open Lan Mouse on this Mac first."
            : data?.active
              ? left === null
                ? "On. Moving the cursor to the screen edge goes to the PC."
                : `On. Comes back to the Mac by itself in ${left} min.`
              : "Off. The cursor stays on this Mac, so it can't wander into a screen you aren't looking at."
        }
        checked={data?.active === true}
        disabled={!running || busy}
        onChange={(checked) => void apply(checked)}
      />
      <SelectField label="Switch back" value={duration} disabled={!running || busy || data?.active === true} onChange={(event) => setDuration(event.target.value)}>
        {DURATIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </SelectField>
      <p className="mt-1.5 text-[11px] leading-snug text-[var(--text-secondary)]">If the cursor gets stuck on the PC, press the release shortcut set in Lan Mouse, or wait for the time above.</p>
      {data?.error && <p className="mt-1 text-xs text-[var(--warn)]">{data.error}</p>}
    </div>
  );
}

export function HostAppsCard({ index }: { index: number }) {
  const [settings] = useSettings();
  const profile = activeOf(settings);
  const target = { host: profile.host.trim(), user: profile.user.trim() };
  const status = useHostAppStatus(profile.host, profile.user);
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const data = status.data;
  const state = data?.state ?? "stopped";
  const reachable = data?.reachable === true;
  const running = RUNNING.includes(state);

  const run = async (action: HostAppAction) => {
    setBusy(true);
    const result = await window.api.controlHostApp({ target, app: "lan-mouse", action });
    setBusy(false);
    queryClient.setQueryData(["host-app", "lan-mouse", target.host, target.user], result);
  };

  return (
    <Tile className="col-span-6" index={index} title={`Apps on ${profile.name}`} action={<Pill tone={reachable ? "ok" : "warn"}>{reachable ? "Reachable" : "Not reachable"}</Pill>}>
      <div className="flex items-center justify-between gap-4 py-2">
        <div className="min-w-0">
          <div>Lan Mouse</div>
          <div className="mt-0.5 text-xs text-[var(--text-secondary)]">
            {state === "not-set-up" ? "One-time setup so it opens on your screen, not hidden in the background." : "Opens on the PC's screen so one keyboard and mouse can move between both."}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {reachable && <Pill tone={running ? "ok" : state === "failed" || state === "not-installed" ? "warn" : "neutral"}>{LABEL[state]}</Pill>}
          {state === "not-set-up" ? (
            <Button variant="primary" disabled={!reachable || busy} onClick={() => void run("setup")}>
              {busy ? "Setting up…" : "Set up"}
            </Button>
          ) : running ? (
            <Button disabled={!reachable || busy} onClick={() => void run("close")}>
              {busy ? "Closing…" : "Close"}
            </Button>
          ) : (
            <Button variant="primary" disabled={!reachable || busy || state === "not-installed"} onClick={() => void run("open")}>
              {busy ? "Opening…" : "Open"}
            </Button>
          )}
        </div>
      </div>
      {data?.error && !reachable && <p className="text-xs text-[var(--warn)]">{data.error}</p>}
      <ShareRow host={profile.name} />
      {state === "failed" && reachable && <p className="text-xs text-[var(--warn)]">It didn't open. The PC may be locked or signed out.</p>}
    </Tile>
  );
}
