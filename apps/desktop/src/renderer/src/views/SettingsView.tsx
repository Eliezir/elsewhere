import { Button, FIELD, SliderRow, TextField, ToggleRow } from "@/components/controls";
import { OpenTailscaleButton } from "@/components/OpenTailscaleButton";
import { Pill, Tile } from "@/components/Tile";
import { useVmSnapshot } from "@/data/hooks";
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
  const [settings, update] = useSettings();
  const { connection } = useOverviewModel();
  const vm = useVmSnapshot();
  const snapshot = vm.data;
  const health = snapshot?.health ?? null;
  const testing = vm.isFetching;

  return (
    <div className="h-full overflow-y-auto">
      <div className="grid auto-rows-[minmax(300px,auto)] grid-cols-12 gap-3">
        <Tile className="col-span-6" title="Connection" action={<Pill tone={snapshot?.reachable ? "ok" : "warn"}>{snapshot?.reachable ? "VM reachable" : HEALTH_LABEL[connection.health]}</Pill>}>
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <TextField label="VM host" value={settings.host} onChange={(event) => update({ host: event.target.value })} />
              <TextField label="SSH user" value={settings.user} onChange={(event) => update({ user: event.target.value })} />
            </div>
            <div className="space-y-2 rounded-2xl bg-[var(--inset)] px-3.5 py-3">
              <StatusRow label="Tailscale" value={HEALTH_LABEL[connection.health]} tone={connection.health === "ok" ? "ok" : "warn"} />
              <StatusRow label="SSH" value={snapshot ? (snapshot.reachable ? `connected · ${snapshot.latencyMs ?? "–"} ms` : (snapshot.error ?? "unreachable")) : "checking…"} tone={snapshot?.reachable ? "ok" : "warn"} />
              <StatusRow label="Git on the VM" value={health?.gitVersion ?? "unknown"} />
              <StatusRow label="Claude Code on the VM" value={health ? (health.claudeInstalled ? "installed" : "not found") : "unknown"} tone={health ? (health.claudeInstalled ? "ok" : "warn") : undefined} />
            </div>
            <div className="mt-auto flex items-center gap-2">
              <Button onClick={() => void vm.refetch()} disabled={testing}>
                {testing ? "Testing…" : "Test connection"}
              </Button>
              <OpenTailscaleButton />
            </div>
          </div>
        </Tile>
        <Tile className="col-span-6" index={1} title="Repositories">
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            <RepoField label="On this Mac" hint="One repository per line. Every worktree of each one is listed." value={settings.macRepos} onChange={(macRepos) => update({ macRepos })} />
            <RepoField label="On the VM" hint="Extra repositories to list. Projects you move are tracked automatically." value={settings.vmRepos} onChange={(vmRepos) => update({ vmRepos })} />
          </div>
        </Tile>
      <Tile className="col-span-6" index={2} title="Thresholds">
        <div className="min-h-0 flex-1 overflow-y-auto">
          <SliderRow label="Disk warning" hint="Alert when the VM disk is fuller than this." value={settings.diskWarn} min={50} max={95} onChange={(diskWarn) => update({ diskWarn })} />
          <SliderRow label="Idle risk line" hint="Oracle reclaims a VM under this for seven days." value={settings.idleLine} min={5} max={40} onChange={(idleLine) => update({ idleLine })} />
          <SliderRow label="Pacer cap" hint="Hold queued tasks above this 5-hour usage." value={settings.pacerCap} min={30} max={100} onChange={(pacerCap) => update({ pacerCap })} />
        </div>
      </Tile>
      <Tile className="col-span-6" index={3} title="Notifications">
        <div className="min-h-0 flex-1 overflow-y-auto">
          <ToggleRow label="VM unreachable" checked={settings.notifyUnreachable} onChange={(notifyUnreachable) => update({ notifyUnreachable })} />
          <ToggleRow label="Disk almost full" checked={settings.notifyDisk} onChange={(notifyDisk) => update({ notifyDisk })} />
          <ToggleRow label="Idle risk" hint="Before Oracle can reclaim the VM." checked={settings.notifyIdle} onChange={(notifyIdle) => update({ notifyIdle })} />
          <ToggleRow label="Weekly allowance going unused" checked={settings.notifyWeekly} onChange={(notifyWeekly) => update({ notifyWeekly })} />
          <ToggleRow label="Morning digest" hint="Summary of what the queue finished overnight." checked={settings.notifyDigest} onChange={(notifyDigest) => update({ notifyDigest })} />
        </div>
      </Tile>
      <Tile className="col-span-6" index={4} title="General">
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
    </div>
  );
}
