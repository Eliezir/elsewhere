import { useMemo, useState } from "react";
import type { StorageEntry, VmPort } from "@vmc/shared";
import { Meter } from "@/components/charts";
import { Button, Segmented, ToggleRow } from "@/components/controls";
import { Pill, Tile } from "@/components/Tile";
import { useVmPorts, useVmSnapshot, useVmStorage } from "@/data/hooks";
import { formatBytes } from "@/lib/format";
import { labelFor, shortPath } from "@/lib/ports";
import { useSettings } from "@/lib/settings";

const STATE_LABEL = {
  off: "Not forwarded",
  active: "Forwarded",
  remapped: "Forwarded",
  failed: "Forward failed",
} as const;

function PortRow({ port, project, busy, onToggle }: { port: VmPort; project: string | null; busy: boolean; onToggle: (enabled: boolean) => void }) {
  const forwarded = port.state === "active" || port.state === "remapped";
  return (
    <li className="flex items-center gap-4 rounded-2xl bg-white/[0.04] px-4 py-3">
      <div className="w-16 text-2xl font-medium tabular-nums">{port.port}</div>
      <div className="min-w-0 flex-1">
        <div className="truncate">{project ?? port.process}</div>
        <div className="mt-0.5 truncate text-xs text-[var(--text-secondary)]">
          {forwarded && port.localPort !== null
            ? port.state === "remapped"
              ? `localhost:${port.localPort} · ${port.port} is busy on this Mac`
              : `localhost:${port.localPort} on this Mac`
            : `${port.process}${port.cwd ? ` · ${shortPath(port.cwd)}` : ""}`}
        </div>
      </div>
      <Pill tone={port.state === "failed" ? "warn" : forwarded ? "ok" : "neutral"}>{STATE_LABEL[port.state]}</Pill>
      {forwarded && port.localPort !== null && (
        <Button onClick={() => void window.api.openLocalPort(port.localPort ?? 0)} className="!py-1.5">
          Open
        </Button>
      )}
      <Button disabled={busy} onClick={() => onToggle(!forwarded)} className="!py-1.5">
        {forwarded ? "Stop" : "Forward"}
      </Button>
    </li>
  );
}

function PortsTile({ className }: { className: string }) {
  const [settings, update] = useSettings();
  const ports = useVmPorts();
  const snapshot = useVmSnapshot();
  const [busyPort, setBusyPort] = useState<number | null>(null);
  const trees = useMemo(() => snapshot.data?.worktrees ?? [], [snapshot.data]);
  const target = { host: settings.host.trim(), user: settings.user.trim() };

  const toggle = async (port: number, enabled: boolean) => {
    setBusyPort(port);
    try {
      await window.api.setPortForward({ target, port, enabled });
    } finally {
      setBusyPort(null);
      void ports.refetch();
    }
  };

  const list = ports.data?.ports ?? [];
  return (
    <Tile className={className} title="Running on the VM" action={<Pill>{`${list.length} listening`}</Pill>}>
      <ToggleRow label="Forward new ports automatically" hint="Each project's dev server becomes reachable on this Mac as it starts." checked={settings.autoForward} onChange={(autoForward) => update({ autoForward })} />
      <div className="mt-2 min-h-0 flex-1 overflow-y-auto">
        {ports.data && !ports.data.reachable ? (
          <p className="text-xs text-[var(--text-secondary)]">{ports.data.error}</p>
        ) : list.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)]">{ports.isPending ? "Looking for running servers…" : "Nothing is listening. Start a dev server on the VM and it will show up here."}</p>
        ) : (
          <ul className="space-y-2">
            {list.map((port) => {
              return <PortRow key={port.port} port={port} project={labelFor(port.cwd, trees)} busy={busyPort === port.port} onToggle={(enabled) => void toggle(port.port, enabled)} />;
            })}
          </ul>
        )}
      </div>
    </Tile>
  );
}

type Scope = "projects" | "home";

const SCOPES = [
  { value: "projects", label: "Projects" },
  { value: "home", label: "Home folders" },
] as const;

function StorageRow({ entry, max }: { entry: StorageEntry; max: number }) {
  return (
    <li className="py-2">
      <div className="mb-1.5 flex items-center justify-between gap-4">
        <span className="truncate">{shortPath(entry.path)}</span>
        <span className="shrink-0 tabular-nums text-[var(--text-secondary)]">{formatBytes(entry.bytes)}</span>
      </div>
      <Meter value={max === 0 ? 0 : (entry.bytes / max) * 100} />
    </li>
  );
}

function StorageTile({ className }: { className: string }) {
  const [settings] = useSettings();
  const storage = useVmStorage();
  const [scope, setScope] = useState<Scope>("projects");
  const data = storage.data;
  const entries = (data?.entries ?? []).filter((entry) => (scope === "projects" ? entry.kind !== "home" : entry.kind === "home"));
  const max = entries[0]?.bytes ?? 0;
  const diskPercent = data && data.diskTotalBytes > 0 ? Math.round((data.diskUsedBytes / data.diskTotalBytes) * 100) : null;
  return (
    <Tile
      className={className}
      index={1}
      title="Storage"
      action={
        <Button onClick={() => void storage.refetch()} disabled={storage.isFetching} className="!py-1">
          {storage.isFetching ? "Scanning…" : "Rescan"}
        </Button>
      }
    >
      {data && !data.reachable ? (
        <p className="text-xs text-[var(--text-secondary)]">{data.error}</p>
      ) : (
        <>
          {data && diskPercent !== null && (
            <div className="mb-3">
              <div className="mb-1.5 flex justify-between text-xs text-[var(--text-secondary)]">
                <span>{`${formatBytes(data.diskUsedBytes)} used of ${formatBytes(data.diskTotalBytes)}`}</span>
                <span>{`${diskPercent}%`}</span>
              </div>
              <Meter value={diskPercent} color={diskPercent >= settings.diskWarn ? "var(--warn)" : "var(--accent)"} />
            </div>
          )}
          <Segmented id="storage-scope" label="Group" options={SCOPES} value={scope} onChange={setScope} />
          <ul className="mt-2 min-h-0 flex-1 divide-y divide-white/5 overflow-y-auto text-[13px]">
            {storage.isPending ? <li className="py-2 text-xs text-[var(--text-muted)]">Measuring folders, this takes a moment…</li> : entries.map((entry) => <StorageRow key={entry.path} entry={entry} max={max} />)}
          </ul>
        </>
      )}
    </Tile>
  );
}

export function VmView() {
  return (
    <div className="grid h-full grid-cols-12 gap-3">
      <PortsTile className="col-span-7" />
      <StorageTile className="col-span-5" />
    </div>
  );
}
