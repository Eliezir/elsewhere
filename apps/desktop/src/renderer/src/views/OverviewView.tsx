import { AreaChart, BigNumber, Meter } from "@/components/charts";
import { GamingModeCard } from "@/components/GamingModeCard";
import { Pill, Tile } from "@/components/Tile";
import { WorktreeAccordion } from "@/components/WorktreeAccordion";
import { useHostKind, useHostName } from "@/lib/useHost";
import { useOverviewModel } from "./overview/model";
import { Loadable, Unavailable } from "./overview/parts";

export function OverviewView() {
  const host = useHostName();
  const kind = useHostKind();
  const model = useOverviewModel();
  const { vm } = model;
  const diskRatio = vm ? vm.diskUsedGb / vm.diskTotalGb : 0;

  return (
    <div className="grid h-full grid-cols-12 gap-3">
      <div className="col-span-9 grid min-h-0 grid-cols-2 grid-rows-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-3">
        <Tile index={0} title="CPU load" action={vm && <Pill>{`${vm.cores} cores`}</Pill>}>
          <Loadable model={model}>
            {vm ? (
              <div className="flex min-h-0 flex-1 flex-col justify-between">
                <BigNumber value={String(vm.cpu)} unit="%" />
                <div className="my-3 min-h-0 flex-1">
                  {vm.loadSeries.length >= 2 ? <AreaChart values={vm.loadSeries.slice(-12)} /> : <p className="text-xs text-[var(--text-muted)]">Collecting samples…</p>}
                </div>
                <div>
                  <Meter value={vm.cpu} color="var(--ok)" />
                  <div className="mt-2 text-xs text-[var(--text-secondary)]">
                    {vm.memUsedGb} of {vm.memTotalGb} GB memory · {vm.diskUsedGb} of {vm.diskTotalGb} GB disk
                  </div>
                </div>
              </div>
            ) : (
              <Unavailable model={model} what={`${host} health`} />
            )}
          </Loadable>
        </Tile>
        <Tile index={1} title="Disk" action={vm && <Pill tone={diskRatio >= 0.8 ? "warn" : "ok"}>{`${vm.diskTotalGb - vm.diskUsedGb} GB free`}</Pill>}>
          <Loadable model={model}>
            {vm ? (
              <div className="flex min-h-0 flex-1 flex-col justify-between">
                <BigNumber value={String(Math.round(diskRatio * 100))} unit="%" tone={diskRatio >= 0.8 ? "warn" : undefined} />
                <p className="my-3 flex-1 text-xs leading-relaxed text-[var(--text-secondary)]">{`${vm.diskUsedGb} of ${vm.diskTotalGb} GB used on ${host}.`}</p>
                <Meter value={diskRatio * 100} color={diskRatio >= 0.8 ? "var(--warn)" : "var(--ok)"} />
              </div>
            ) : (
              <Unavailable model={model} what={`${host} disk`} />
            )}
          </Loadable>
        </Tile>
        <Tile index={2} title={`${host} load · recent samples`} className="col-span-2" action={model.connection.latencyMs !== null && <Pill>{`${model.connection.latencyMs} ms`}</Pill>}>
          <Loadable model={model}>
            {vm ? (
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="min-h-0 flex-1">
                  {vm.loadSeries.length >= 2 ? <AreaChart values={vm.loadSeries} /> : <p className="text-xs text-[var(--text-muted)]">Collecting samples, one every five minutes.</p>}
                </div>
                <div className="mt-2 flex justify-between text-[11px] text-[var(--text-muted)]">
                  <span>oldest</span>
                  <span></span>
                  <span>now</span>
                </div>
              </div>
            ) : (
              <Unavailable model={model} what={`${host} load`} />
            )}
          </Loadable>
        </Tile>
      </div>
      <div className="col-span-3 flex min-h-0 flex-col gap-3">
        <WorktreeAccordion model={model} />
        {kind === "pc" && <GamingModeCard />}
      </div>
    </div>
  );
}
