import { useMemo, useState } from "react";
import type { StorageEntry, VmPort } from "@vmc/shared";
import { Meter } from "@/components/charts";
import { Button, Segmented, ToggleRow } from "@/components/controls";
import { Pill, Tile } from "@/components/Tile";
import { ProjectIcon } from "@/components/ProjectIcon";
import { useProjectIcons, useVmPorts, useVmSnapshot, useVmStorage } from "@/data/hooks";
import { formatBytes } from "@/lib/format";
import { groupPorts, relativeTo, serviceLabel, shortPath } from "@/lib/ports";
import { useSettings } from "@/lib/settings";

const STATE_LABEL = {
  off: "Not forwarded",
  active: "Forwarded",
  remapped: "Forwarded",
  failed: "Forward failed",
} as const;

type KillPhase = "confirm" | "working" | "force";
type KillAction = "ask" | "stop" | "force" | "cancel";

interface KillState {
  port: number;
  phase: KillPhase;
  message: string | null;
}

interface PortRowProps {
  port: VmPort;
  root: string | null;
  busy: boolean;
  kill: KillState | null;
  onToggle: (enabled: boolean) => void;
  onKill: (action: KillAction) => void;
}

function PortRow({ port, root, busy, kill, onToggle, onKill }: PortRowProps) {
  const forwarded = port.state === "active" || port.state === "remapped";
  const pinned = port.pinnedLocal !== null && port.pinnedLocal === port.localPort;
  const where =
    forwarded && port.localPort !== null
      ? port.state === "remapped"
        ? `localhost:${port.localPort} · use this link, not :${port.pinnedLocal ?? port.port}, which is busy here${port.busyBy ? ` (${port.busyBy})` : ""}`
        : `localhost:${port.localPort} on this Mac${pinned ? " · pinned" : ""}`
      : "Not reachable from this Mac";
  const [copied, setCopied] = useState(false);
  const [pinning, setPinning] = useState(false);
  const [draft, setDraft] = useState("");

  const copy = () => {
    if (port.localPort === null) return;
    void navigator.clipboard.writeText(`http://localhost:${port.localPort}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const savePin = (value: number | null) => {
    void window.api.setPortPin({ key: port.pinKey, local: value }).then(() => setPinning(false));
  };

  const draftNumber = Number(draft);
  const draftValid = Number.isInteger(draftNumber) && draftNumber >= 1024 && draftNumber <= 65535;
  const killing = kill?.port === port.port ? kill : null;
  return (
    <li className="rounded-2xl bg-white/[0.04] px-4 py-3">
      <div className="flex items-center gap-4">
        <div className="w-16 text-2xl font-medium tabular-nums">{port.port}</div>
        <div className="min-w-0 flex-1">
          <div className="truncate">{relativeTo(port.cwd, root) ?? port.process}</div>
          <div className="mt-0.5 text-xs leading-snug text-[var(--text-secondary)]">
            {killing?.message ?? (killing?.phase === "confirm" ? "This stops the server on the VM." : killing?.phase === "force" ? "It did not exit. Force it?" : where)}
          </div>
        </div>
        {!killing && <Pill tone={port.state === "failed" ? "warn" : forwarded ? "ok" : "neutral"}>{STATE_LABEL[port.state]}</Pill>}
      </div>
      <div className="mt-2.5 flex flex-wrap items-center justify-end gap-2">
        {killing ? (
          <>
            <Button disabled={killing.phase === "working"} onClick={() => onKill("cancel")} className="!py-1.5">
              Cancel
            </Button>
            <Button variant="danger" disabled={killing.phase === "working"} onClick={() => onKill(killing.phase === "force" ? "force" : "stop")} className="!py-1.5">
              {killing.phase === "working" ? "Stopping…" : killing.phase === "force" ? "Force kill" : "Stop server"}
            </Button>
          </>
        ) : (
          <>
            {forwarded && port.localPort !== null && (
              <>
                <Button onClick={() => void window.api.openLocalPort(port.localPort ?? 0)} className="!py-1.5">
                  Open
                </Button>
                <Button onClick={copy} className="!py-1.5">
                  {copied ? "Copied" : "Copy link"}
                </Button>
              </>
            )}
            <Button
              onClick={() => {
                setDraft(port.pinnedLocal === null ? "" : String(port.pinnedLocal));
                setPinning((open) => !open);
              }}
              title="Always use this number on your Mac for this project's port"
              className="!py-1.5"
            >
              {port.pinnedLocal === null ? "Pin port" : `Pinned :${port.pinnedLocal}`}
            </Button>
            <Button disabled={busy} onClick={() => onToggle(!forwarded)} title={forwarded ? "Closes the tunnel to this Mac. The server keeps running on the VM." : "Opens a tunnel from this Mac to the VM"} className="!py-1.5">
              {forwarded ? "Stop forwarding" : "Forward"}
            </Button>
            <Button onClick={() => onKill("ask")} title="Stops the server process on the VM" className="!py-1.5 hover:!bg-[var(--down)]/25">
              Kill
            </Button>
          </>
        )}
      </div>
      {pinning && !killing && (
        <div className="mt-2.5 flex flex-wrap items-center justify-end gap-2">
          <span className="mr-auto text-xs text-[var(--text-secondary)]">Local port on this Mac (1024–65535)</span>
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value.replace(/\D/g, "").slice(0, 5))}
            inputMode="numeric"
            placeholder={String(port.port)}
            spellCheck={false}
            className="w-24 rounded-full border border-[var(--hairline)] bg-[var(--inset)] px-3 py-1.5 text-center tabular-nums outline-none transition-[box-shadow] duration-200 focus:shadow-[0_0_0_3px_oklch(0.62_0.24_285/0.45)]"
          />
          {port.pinnedLocal !== null && (
            <Button onClick={() => savePin(null)} className="!py-1.5">
              Clear
            </Button>
          )}
          <Button variant="primary" disabled={!draftValid} onClick={() => savePin(draftNumber)} className="!py-1.5">
            Save pin
          </Button>
        </div>
      )}
    </li>
  );
}

function ServiceRow({ port }: { port: VmPort }) {
  return (
    <li className="flex items-center gap-4 rounded-2xl px-4 py-2 opacity-70">
      <div className="w-16 text-base tabular-nums text-[var(--text-secondary)]">{port.port}</div>
      <div className="min-w-0 flex-1 truncate text-[13px]">{serviceLabel(port.port, port.process)}</div>
      <Pill>Read only</Pill>
    </li>
  );
}

function PortsTile({ className }: { className: string }) {
  const [settings, update] = useSettings();
  const ports = useVmPorts();
  const snapshot = useVmSnapshot();
  const [busyPort, setBusyPort] = useState<number | null>(null);
  const [kill, setKill] = useState<KillState | null>(null);
  const trees = useMemo(() => snapshot.data?.worktrees ?? [], [snapshot.data]);
  const icons = useProjectIcons().data ?? {};
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

  const runKill = async (port: number, force: boolean) => {
    setKill({ port, phase: "working", message: null });
    const result = await window.api.killVmPort({ target, port, force });
    if (!result.ok) {
      setKill({ port, phase: "confirm", message: result.message });
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const fresh = await ports.refetch();
    const stillThere = fresh.data?.ports.some((item) => item.port === port) ?? false;
    setKill(stillThere ? { port, phase: "force", message: null } : null);
  };

  const handleKill = (port: number, action: KillAction) => {
    if (action === "cancel") setKill(null);
    else if (action === "ask") setKill({ port, phase: "confirm", message: null });
    else void runKill(port, action === "force");
  };

  const all = ports.data?.ports ?? [];
  const list = all.filter((port) => port.kind === "project");
  const services = all.filter((port) => port.kind === "service");
  const groups = useMemo(() => groupPorts(list, trees), [list, trees]);
  return (
    <Tile className={className} title="Running on the VM" action={<Pill>{`${groups.length} ${groups.length === 1 ? "project" : "projects"}`}</Pill>}>
      <ToggleRow label="Forward new ports automatically" hint="Each project's dev server becomes reachable on this Mac as it starts." checked={settings.autoForward} onChange={(autoForward) => update({ autoForward })} />
      <div className="mt-2 min-h-0 flex-1 overflow-y-auto">
        {ports.data && !ports.data.reachable ? (
          <p className="text-xs text-[var(--text-secondary)]">{ports.data.error}</p>
        ) : list.length === 0 && services.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)]">{ports.isPending ? "Looking for running servers…" : "Nothing is listening. Start a dev server on the VM and it will show up here."}</p>
        ) : (
          <div className="space-y-5">
            {groups.map((group) => (
              <section key={group.key}>
                <header className="mb-2 flex items-center gap-3 px-1">
                  <ProjectIcon repo={group.repo} icon={icons[group.repo]?.icon} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{`${group.repo} · ${group.name}`}</div>
                    {group.branch !== null && <div className="truncate text-xs text-[var(--text-secondary)]">{group.branch}</div>}
                  </div>
                  <Pill>{`${group.ports.length} ${group.ports.length === 1 ? "port" : "ports"}`}</Pill>
                </header>
                <ul className="space-y-2">
                  {group.ports.map((port) => (
                    <PortRow key={port.port} port={port} root={group.root} busy={busyPort === port.port} kill={kill} onToggle={(enabled) => void toggle(port.port, enabled)} onKill={(action) => handleKill(port.port, action)} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
        {services.length > 0 && (
          <div className="mt-4">
            <div className="mb-1 px-4 text-xs text-[var(--text-muted)]">Other services</div>
            <ul>
              {services.map((port) => (
                <ServiceRow key={port.port} port={port} />
              ))}
            </ul>
          </div>
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
