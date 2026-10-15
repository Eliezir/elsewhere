import { SliderRow, TextField, ToggleRow, Button } from "@/components/controls";
import { Pill, Tile } from "@/components/Tile";
import { useOverviewModel } from "@/views/overview/model";
import { DEFAULT_SETTINGS, useSettings } from "@/lib/settings";

const HEALTH_LABEL = { ok: "online", warn: "not on tailnet", down: "unreachable", unknown: "checking" } as const;

export function SettingsView() {
  const [settings, update] = useSettings();
  const { connection } = useOverviewModel();

  return (
    <div className="grid h-full grid-cols-12 grid-rows-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
      <Tile className="col-span-6" title="Connection" action={<Pill tone={connection.health === "ok" ? "ok" : "warn"}>{HEALTH_LABEL[connection.health]}</Pill>}>
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
          <TextField label="VM host" value={settings.host} onChange={(event) => update({ host: event.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <TextField label="SSH user" value={settings.user} onChange={(event) => update({ user: event.target.value })} />
            <TextField
              label="Daemon port"
              inputMode="numeric"
              value={String(settings.daemonPort)}
              onChange={(event) => {
                const port = Number(event.target.value.replace(/\D/g, ""));
                if (port <= 65535) update({ daemonPort: port });
              }}
            />
          </div>
          <div className="mt-auto flex items-center justify-between rounded-2xl bg-[var(--inset)] px-3 py-2.5 text-xs text-[var(--text-secondary)]">
            <span>Daemon token</span>
            <span>Stored in the macOS Keychain once the daemon exists</span>
          </div>
        </div>
      </Tile>
      <Tile className="col-span-6" index={1} title="Thresholds">
        <div className="min-h-0 flex-1 overflow-y-auto">
          <SliderRow label="Disk warning" hint="Alert when the VM disk is fuller than this." value={settings.diskWarn} min={50} max={95} onChange={(diskWarn) => update({ diskWarn })} />
          <SliderRow label="Idle risk line" hint="Oracle reclaims a VM under this for seven days." value={settings.idleLine} min={5} max={40} onChange={(idleLine) => update({ idleLine })} />
          <SliderRow label="Pacer cap" hint="Hold queued tasks above this 5-hour usage." value={settings.pacerCap} min={30} max={100} onChange={(pacerCap) => update({ pacerCap })} />
        </div>
      </Tile>
      <Tile className="col-span-6" index={2} title="Notifications">
        <div className="min-h-0 flex-1 overflow-y-auto">
          <ToggleRow label="VM unreachable" checked={settings.notifyUnreachable} onChange={(notifyUnreachable) => update({ notifyUnreachable })} />
          <ToggleRow label="Disk almost full" checked={settings.notifyDisk} onChange={(notifyDisk) => update({ notifyDisk })} />
          <ToggleRow label="Idle risk" hint="Before Oracle can reclaim the VM." checked={settings.notifyIdle} onChange={(notifyIdle) => update({ notifyIdle })} />
          <ToggleRow label="Weekly allowance going unused" checked={settings.notifyWeekly} onChange={(notifyWeekly) => update({ notifyWeekly })} />
          <ToggleRow label="Morning digest" hint="Summary of what the queue finished overnight." checked={settings.notifyDigest} onChange={(notifyDigest) => update({ notifyDigest })} />
        </div>
      </Tile>
      <Tile className="col-span-6" index={3} title="General">
        <div className="flex min-h-0 flex-1 flex-col">
          <ToggleRow label="Start at login" checked={settings.startAtLogin} onChange={(startAtLogin) => update({ startAtLogin })} />
          <ToggleRow label="Show in the menu bar" checked={settings.showInMenuBar} onChange={(showInMenuBar) => update({ showInMenuBar })} />
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
  );
}
