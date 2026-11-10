import { useQueryClient } from "@tanstack/react-query";
import type { HostAppAction, HostAppState } from "@vmc/shared";
import { useState } from "react";
import { Button } from "@/components/controls";
import { Pill, Tile } from "@/components/Tile";
import { useHostAppStatus } from "@/data/hooks";
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
      {state === "failed" && reachable && <p className="text-xs text-[var(--warn)]">It didn't open. The PC may be locked or signed out.</p>}
    </Tile>
  );
}
