import { Button, Segmented, TextField } from "@/components/controls";
import { WakeButton } from "@/components/WakeButton";
import { activeOf, addHost, editActive, hostKind, profilesOf, removeActive, selectHost } from "@/lib/hosts";
import { useSettings } from "@/lib/settings";

const KINDS = [
  { value: "pc", label: "PC" },
  { value: "vm", label: "VM" },
] as const;

export function HostSwitcher() {
  const [settings, update] = useSettings();
  const profiles = profilesOf(settings);
  const active = activeOf(settings);
  const options = profiles.map((profile) => ({ value: profile.id, label: profile.name || "Host" }));

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Segmented id="host-profile" label="Primary host" options={options} value={active.id} onChange={(id) => update(selectHost(settings, id))} />
        <Button onClick={() => update(addHost(settings, `host-${Date.now().toString(36)}`))} aria-label="Add a host" className="!px-3 !py-1 text-xs">
          +
        </Button>
        {profiles.length > 1 && (
          <Button onClick={() => update(removeActive(settings))} aria-label="Remove this host" className="!px-3 !py-1 text-xs">
            Remove
          </Button>
        )}
      </div>
      <p className="text-xs text-[var(--text-secondary)]">The primary host is the one the menu bar, Overview, ports and worktrees follow. Switch it any time.</p>
      <Segmented id="host-kind" label="Type" options={KINDS} value={hostKind(active)} onChange={(kind) => update(editActive(settings, { kind }))} />
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Name" value={active.name} onChange={(event) => update(editActive(settings, { name: event.target.value }))} />
        <TextField label="MAC address (for Wake)" placeholder="aa:bb:cc:dd:ee:ff" value={active.mac} onChange={(event) => update(editActive(settings, { mac: event.target.value }))} />
      </div>
      {active.mac.trim() !== "" && <WakeButton mac={active.mac} />}
    </div>
  );
}
