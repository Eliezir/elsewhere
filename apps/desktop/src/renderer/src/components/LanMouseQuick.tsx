import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/controls";
import { useHostAppStatus, useLanMouse } from "@/data/hooks";
import { activeOf } from "@/lib/hosts";
import { useSettings } from "@/lib/settings";

const SHARE_MINUTES = 15;

export function LanMouseQuick() {
  const [settings] = useSettings();
  const profile = activeOf(settings);
  const target = { host: profile.host.trim(), user: profile.user.trim() };
  const queryClient = useQueryClient();
  const app = useHostAppStatus(profile.host, profile.user);
  const share = useLanMouse();
  const [busy, setBusy] = useState(false);
  const appState = app.data?.state ?? "stopped";
  const appReachable = app.data?.reachable === true;
  const appRunning = appState === "running" || appState === "started";
  const macRunning = share.data?.running === true;
  const sharing = share.data?.active === true;
  const left = share.data?.backAt ? Math.max(1, Math.ceil((share.data.backAt - Date.now()) / 60000)) : null;

  const toggleApp = async () => {
    setBusy(true);
    const result = await window.api.controlHostApp({ target, app: "lan-mouse", action: appState === "not-set-up" ? "setup" : appRunning ? "close" : "open" });
    setBusy(false);
    queryClient.setQueryData(["host-app", "lan-mouse", target.host, target.user], result);
  };

  const toggleShare = async () => {
    setBusy(true);
    const result = await window.api.controlLanMouse(sharing ? { action: "stop" } : { action: "share", minutes: SHARE_MINUTES });
    setBusy(false);
    queryClient.setQueryData(["lan-mouse"], result);
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="leading-tight">{`Lan Mouse on ${profile.name}`}</div>
          <div className="text-[11px] leading-tight text-[var(--text-secondary)]">{!appReachable ? "Not reachable" : appState === "not-set-up" ? "Needs one-time setup" : appRunning ? "Running" : "Closed"}</div>
        </div>
        <Button className="!px-3 !py-1 text-xs" disabled={!appReachable || busy || appState === "not-installed"} onClick={() => void toggleApp()}>
          {appState === "not-set-up" ? "Set up" : appRunning ? "Close Lan Mouse" : "Open Lan Mouse"}
        </Button>
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="leading-tight">Keyboard and mouse</div>
          <div className="text-[11px] leading-tight text-[var(--text-secondary)]">
            {!macRunning ? "Open Lan Mouse on this Mac" : sharing ? (left === null ? "Going to the PC" : `Back on the Mac in ${left} min`) : "Staying on this Mac"}
          </div>
        </div>
        <Button variant={sharing ? "danger" : "primary"} className="!px-3 !py-1 text-xs" disabled={!macRunning || busy} onClick={() => void toggleShare()}>
          {sharing ? "Bring back" : `Use for ${SHARE_MINUTES} min`}
        </Button>
      </div>
    </div>
  );
}
