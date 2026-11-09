import type { UseQueryResult } from "@tanstack/react-query";
import type { VmStorage } from "@vmc/shared";
import { useEffect, useState } from "react";
import { Meter } from "@/components/charts";
import { Button } from "@/components/controls";
import { Pill, Tile } from "@/components/Tile";
import { useHostStorage, useMacStorage } from "@/data/hooks";
import { formatBytes } from "@/lib/format";
import { profilesOf } from "@/lib/hosts";
import { useSettings } from "@/lib/settings";
import { changeOver, formatChange, homeRelative, loadHistory, recordSample, saveHistory, type StorageSample } from "@/lib/storageHistory";

const DAY = 24 * 3600 * 1000;
const TOP = 8;
const GIGABYTE = 1024 ** 3;

interface CardProps {
  id: string;
  name: string;
  index: number;
  query: UseQueryResult<VmStorage>;
}

function HostCard({ id, name, index, query }: CardProps) {
  const [settings] = useSettings();
  const [samples, setSamples] = useState<StorageSample[]>(() => loadHistory()[id] ?? []);
  const data = query.data;
  const total = data?.diskTotalBytes ?? 0;
  const used = data?.diskUsedBytes ?? 0;

  useEffect(() => {
    if (!data?.reachable || total === 0) return;
    const next = recordSample(loadHistory(), id, total - used, Date.now());
    saveHistory(next);
    setSamples(next[id] ?? []);
  }, [data, id, total, used]);

  const percent = total > 0 ? Math.round((used / total) * 100) : null;
  const low = percent !== null && percent >= settings.diskWarn;
  const entries = (data?.entries ?? []).slice(0, TOP);
  const max = entries[0]?.bytes ?? 0;
  const day = changeOver(samples, Date.now(), DAY);

  return (
    <Tile
      index={index}
      title={name}
      action={
        <Button onClick={() => void query.refetch()} disabled={query.isFetching} className="!py-1">
          {query.isFetching ? "Scanning…" : "Rescan"}
        </Button>
      }
    >
      {data && !data.reachable ? (
        <p className="text-xs text-[var(--text-secondary)]">{data.error}</p>
      ) : query.isPending || !data ? (
        <p className="text-xs text-[var(--text-muted)]">Measuring folders, this takes a moment…</p>
      ) : (
        <>
          <div className="mb-3">
            <div className="mb-1.5 flex items-center justify-between gap-2 text-xs text-[var(--text-secondary)]">
              <span>{`${formatBytes(total - used)} free of ${formatBytes(total)}`}</span>
              <span className="flex items-center gap-1.5">
                {day !== null && Math.abs(day) >= GIGABYTE / 10 && <Pill tone={day < 0 ? "warn" : "ok"}>{`${formatChange(day, formatBytes)} in 24 h`}</Pill>}
                {low && <Pill tone="warn">Running low</Pill>}
                <span>{`${percent}%`}</span>
              </span>
            </div>
            <Meter value={percent ?? 0} color={low ? "var(--warn)" : "var(--accent)"} />
          </div>
          <ul className="min-h-0 flex-1 divide-y divide-white/5 text-[13px]">
            {entries.map((entry) => (
              <li key={entry.path} className="py-2">
                <div className="mb-1.5 flex items-center justify-between gap-4">
                  <span className="truncate">{homeRelative(entry.path)}</span>
                  <span className="shrink-0 tabular-nums text-[var(--text-secondary)]">{formatBytes(entry.bytes)}</span>
                </div>
                <Meter value={max === 0 ? 0 : (entry.bytes / max) * 100} />
              </li>
            ))}
          </ul>
        </>
      )}
    </Tile>
  );
}

function MacCard() {
  const query = useMacStorage();
  return <HostCard id="mac" name="This Mac" index={0} query={query} />;
}

function RemoteCard({ id, name, host, user, index }: { id: string; name: string; host: string; user: string; index: number }) {
  const query = useHostStorage(host, user);
  return <HostCard id={id} name={name} index={index} query={query} />;
}

export function StorageView() {
  const [settings] = useSettings();
  const hosts = profilesOf(settings).filter((profile) => profile.host.trim() !== "");
  return (
    <div className="grid h-full auto-rows-min grid-cols-1 gap-3 overflow-y-auto pb-1 xl:grid-cols-2">
      <MacCard />
      {hosts.map((profile, index) => (
        <RemoteCard key={profile.id} id={profile.id} name={profile.name} host={profile.host} user={profile.user} index={index + 1} />
      ))}
    </div>
  );
}
