import { useHostName } from "@/lib/useHost";
import { Button, FIELD, SliderRow, TextField, ToggleRow } from "@/components/controls";
import { ApproveSshButton } from "@/components/ApproveSshButton";
import { HostSwitcher, OtherMachines } from "@/components/HostSwitcher";
import { HostAppsCard } from "@/components/HostAppsCard";
import { ShutdownCard } from "@/components/ShutdownCard";
import { VmTerminalButton } from "@/components/TerminalButtons";
import { Pill, Tile } from "@/components/Tile";
import { useVmSnapshot } from "@/data/hooks";
import { useTailscaleControl } from "@/lib/tailscale";
import { useOverviewModel } from "@/views/overview/model";
import { DEFAULT_SETTINGS, useSettings } from "@/lib/settings";

const HEALTH_LABEL = { ok: "online", warn: "not on tailnet", down: "unreachable", unknown: "checking" } as const;

function StatusRow({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warn" }) {
  const color = tone === "ok" ? "text-[var(--ok)]" : tone === "warn" ? "text-[var(--warn)]" : "";
  return (
    <div className="flex justify-between gap-3 text-xs">
      <span className="text-[var(--text-secondary)]">{label}</span>
      <span className={color}>{value}</span>
    </div>
  );
}

function RepoField({ label, hint, value, onChange }: { label: string; hint: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-[var(--text-secondary)]">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={3}
        spellCheck={false}
        className={`${FIELD} resize-none font-mono text-xs leading-relaxed`}
      />
      <span className="mt-1 block text-[11px] text-[var(--text-muted)]">{hint}</span>
    </label>
  );
}

export function SettingsView() {
  const host = useHostName();
  const [settings, update] = useSettings();
  const { connection } = useOverviewModel();
  const vm = useVmSnapshot();
  const tailscale = useTailscaleControl();
  const tailscaleLabel = tailscale.needsLogin ? "sign-in needed" : tailscale.connected ? "connected" : tailscale.status === undefined || tailscale.status.state === "unknown" ? "checking" : "disconnected";
  const snapshot = vm.data;
  const health = snapshot?.health ?? null;
  const testing = vm.isFetching;

  return (
    <div className="h-full overflow-y-auto">
      <div className="grid auto-rows-[minmax(300px,auto)] grid-cols-12 gap-3">
        <Tile className="col-span-6" title="Connection" action={<Pill tone={snapshot?.reachable ? "ok" : "warn"}>{snapshot?.reachable ? `${host} reachable` : HEALTH_LABEL[connection.health]}</Pill>}>
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            <HostSwitcher />
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Host address" value={settings.host} onChange={(event) => update({ host: event.target.value })} />
              <TextField label="SSH user" value={settings.user} onChange={(event) => update({ user: event.target.value })} />
            </div>
            <div className="space-y-2 rounded-2xl bg-[var(--inset)] px-3.5 py-3">
              <StatusRow label="Tailscale" value={tailscaleLabel} tone={tailscale.connected ? "ok" : "warn"} />
              <StatusRow label="SSH" value={snapshot ? (snapshot.reachable ? `connected · ${snapshot.latencyMs ?? "–"} ms` : (snapshot.error ?? "unreachable")) : "checking…"} tone={snapshot?.reachable ? "ok" : "warn"} />
              <StatusRow label={`Git on ${host}`} value={health?.gitVersion ?? "unknown"} />
              <StatusRow label={`Claude Code on ${host}`} value={health ? (health.claudeInstalled ? "installed" : "not found") : "unknown"} tone={health ? (health.claudeInstalled ? "ok" : "warn") : undefined} />
            </div>
            <div className="mt-auto flex items-center gap-2">
              <Button onClick={() => void vm.refetch()} disabled={testing}>
                {testing ? "Testing…" : "Test connection"}
              </Button>
              <VmTerminalButton disabled={!snapshot?.reachable} />
              <Button onClick={() => void window.api.openTailscale()}>Open Tailscale app</Button>
            </div>
            {snapshot?.approvalUrl && <ApproveSshButton url={snapshot.approvalUrl} />}
          </div>
        <OtherMachines />
        </Tile>
        <Tile className="col-span-6" index={1} title="Tailscale" action={<Pill tone={tailscale.connected ? "ok" : "warn"}>{tailscaleLabel}</Pill>}>
          <div className="flex min-h-0 flex-1 flex-col">
            <ToggleRow
              label={tailscale.needsLogin ? "Sign in to your tailnet" : "Connected to your tailnet"}
              hint={tailscale.status?.tailnet ? `${tailscale.status.tailnet}${tailscale.status.selfIp ? ` · this Mac is ${tailscale.status.selfIp}` : ""}` : "Uses the Tailscale app running in the background."}
              checked={tailscale.connected}
              disabled={tailscale.busy}
              onChange={(next) => (next ? tailscale.connect() : tailscale.disconnect())}
            />
            {tailscale.busy && <p className="text-xs text-[var(--text-secondary)]">Working…</p>}
            {tailscale.message && <p className="text-xs leading-relaxed text-[var(--warn)]">{tailscale.message}</p>}
            <div className="mb-1.5 mt-3 text-xs text-[var(--text-secondary)]">{`Devices${tailscale.status?.peers.length ? ` · ${tailscale.status.peers.length}` : ""}`}</div>
            <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto">
              {(tailscale.status?.peers ?? []).map((peer) => (
                <div key={peer.dnsName || peer.name} className="flex items-center justify-between gap-3 rounded-xl bg-[var(--inset)] px-3 py-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className={`size-2 shrink-0 rounded-full ${tailscale.connected && peer.online ? "bg-[var(--ok)]" : "bg-white/25"}`} />
                    <span className="truncate">{peer.name}</span>
                    {peer.isVm && <Pill tone="ok">Primary</Pill>}
                  </span>
                  <span className="shrink-0 text-[11px] text-[var(--text-secondary)]">{`${peer.os ?? ""}${peer.os && peer.ip ? " · " : ""}${peer.ip ?? ""}`}</span>
                </div>
              ))}
              {(tailscale.status?.peers.length ?? 0) === 0 && <p className="text-xs text-[var(--text-muted)]">{tailscale.connected ? "No other devices yet." : "Connect to see the devices on your tailnet."}</p>}
            </div>
          </div>
        </Tile>
        <HostAppsCard index={2} />
        <ShutdownCard index={2} />
        <Tile className="col-span-6" index={2} title="Repositories">
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            <RepoField label="On this Mac" hint="One repository per line. Every worktree of each one is listed." value={settings.macRepos} onChange={(macRepos) => update({ macRepos })} />
            <RepoField label={`On ${host}`} hint="Extra repositories to list. Projects you move are tracked automatically." value={settings.vmRepos} onChange={(vmRepos) => update({ vmRepos })} />
          </div>
        </Tile>
      <Tile className="col-span-6" index={3} title="Thresholds">
        <div className="min-h-0 flex-1 overflow-y-auto">
          <SliderRow label="Disk warning" hint={`Alert when this Mac or ${host} is fuller than this.`} value={settings.diskWarn} min={50} max={95} onChange={(diskWarn) => update({ diskWarn })} />
          <SliderRow label="Stale after" hint="Worktrees idle this long are suggested for clean-up." value={settings.staleDays} min={7} max={180} unit=" days" onChange={(staleDays) => update({ staleDays })} />
        </div>
      </Tile>
      <Tile className="col-span-6" index={4} title="Notifications">
        <div className="min-h-0 flex-1 overflow-y-auto">
          <ToggleRow label={`${host} unreachable`} checked={settings.notifyUnreachable} onChange={(notifyUnreachable) => update({ notifyUnreachable })} />
          <ToggleRow label="Disk almost full" hint={`This Mac and ${host}, once a day at most`} checked={settings.notifyDisk} onChange={(notifyDisk) => update({ notifyDisk })} />
          <ToggleRow label="Port can't be forwarded" hint="A dev server on the host that this Mac couldn't open" checked={settings.notifyPorts} onChange={(notifyPorts) => update({ notifyPorts })} />
          <div className="pt-2">
            <Button onClick={() => void window.api.sendTestNotification()}>Send a test notification</Button>
          </div>
        </div>
      </Tile>
      <Tile className="col-span-6" index={5} title="General">
        <div className="flex min-h-0 flex-1 flex-col">
          <ToggleRow label="Start at login" checked={settings.startAtLogin} onChange={(startAtLogin) => update({ startAtLogin })} />
          <ToggleRow label="Show in the menu bar" checked={settings.showInMenuBar} onChange={(showInMenuBar) => update({ showInMenuBar })} />
          <ToggleRow
            label="Keep running when the window is closed"
            hint="Hides the Dock icon and keeps forwarding ports from the menu bar. Right-click the menu bar icon to quit."
            checked={settings.runInBackground}
            onChange={(runInBackground) => update({ runInBackground })}
            disabled={!settings.showInMenuBar}
          />
          <ToggleRow
            label="Hide from the Dock"
            hint="Elsewhere lives only in the menu bar, even while its window is open. Open and quit it from the menu bar icon."
            checked={settings.hideFromDock}
            onChange={(hideFromDock) => update({ hideFromDock })}
            disabled={!settings.showInMenuBar}
          />
          <div className="flex items-center justify-between py-2">
            <span>Appearance</span>
            <span className="text-[var(--text-secondary)]">Dark</span>
          </div>
          <div className="mt-auto flex justify-end">
            <Button onClick={() => update(DEFAULT_SETTINGS)}>Reset to defaults</Button>
          </div>
        </div>
      </Tile>
      </div>
    </div>
  );
}
