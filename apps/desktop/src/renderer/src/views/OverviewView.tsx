import { ClaudeMark } from "@/components/ClaudeMark";
import { AreaChart, BigNumber, DayBars, HalfGauge, Meter } from "@/components/charts";
import { QueueHero } from "@/components/QueueHero";
import { Pill, Tile } from "@/components/Tile";
import { WorktreeAccordion } from "@/components/WorktreeAccordion";
import { useOverviewModel } from "./overview/model";
import { Loadable, NoUsage, Unavailable } from "./overview/parts";

export function OverviewView() {
  const model = useOverviewModel();
  const { usage, vm, idle } = model;

  return (
    <div className="grid h-full grid-cols-12 gap-3">
      <div className="col-span-9 grid min-h-0 grid-cols-3 grid-rows-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-3">
        <Tile index={0} title="5-hour usage" icon={<ClaudeMark />} to="usage" action={usage?.fiveHourResets && <Pill>{`resets in ${usage.fiveHourResets}`}</Pill>}>
          <Loadable model={model}>
            {usage && usage.fiveHour !== null ? (
              <div className="flex min-h-0 flex-1 flex-col justify-between">
                <BigNumber value={String(usage.fiveHour)} unit="%" />
                <div className="my-3 min-h-0 flex-1">
                  {usage.fiveHourSeries.length >= 2 ? (
                    <AreaChart values={usage.fiveHourSeries} color="var(--accent)" />
                  ) : (
                    <p className="text-xs text-[var(--text-muted)]">Collecting samples…</p>
                  )}
                </div>
                <Meter value={usage.fiveHour} />
              </div>
            ) : (
              <NoUsage />
            )}
          </Loadable>
        </Tile>
        <Tile index={1} title="CPU load" action={vm && <Pill>{`${vm.cores} cores`}</Pill>}>
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
              <Unavailable model={model} what="VM health" />
            )}
          </Loadable>
        </Tile>
        <Tile index={2} title="Idle health" action={idle?.atRisk ? <Pill tone="warn">at risk</Pill> : idle ? <Pill tone="ok">healthy</Pill> : undefined}>
          <Loadable model={model}>
            {idle ? (
              <div className="flex min-h-0 flex-1 flex-col justify-between">
                <BigNumber value={String(idle.sevenDayCpu)} unit="%" tone={idle.atRisk ? "warn" : undefined} />
                <p className="my-3 flex-1 text-xs leading-relaxed text-[var(--text-secondary)]">
                  Oracle can reclaim the VM when CPU, network and memory stay under {idle.threshold}% for seven days.
                </p>
                <div>
                  <DayBars days={idle.days} />
                  <div className="mt-2 text-xs text-[var(--text-secondary)]">7-day CPU against the {idle.threshold}% line</div>
                </div>
              </div>
            ) : (
              <Unavailable model={model} what="Idle health" />
            )}
          </Loadable>
        </Tile>
        <Tile index={3} title="VM load · recent samples" className="col-span-2" action={model.connection.latencyMs !== null && <Pill>{`${model.connection.latencyMs} ms`}</Pill>}>
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
              <Unavailable model={model} what="VM load" />
            )}
          </Loadable>
        </Tile>
        <Tile index={4} title="Weekly capacity" icon={<ClaudeMark />} to="usage" action={usage?.weeklyResets && <Pill>{`resets in ${usage.weeklyResets}`}</Pill>}>
          <Loadable model={model}>
            {usage && usage.weekly !== null ? (
              <div className="flex min-h-0 flex-1 flex-col items-center justify-between">
                <div className="flex w-full flex-1 items-center justify-center">
                  <HalfGauge value={usage.weekly} />
                </div>
                <div className="flex w-full justify-between text-xs">
                  <span>
                    <span className="text-lg font-medium">{usage.weekly}%</span> <span className="text-[var(--text-secondary)]">used</span>
                  </span>
                  <span className="text-right">
                    <span className="text-lg font-medium">{usage.unused === null ? "–" : `${usage.unused}%`}</span>{" "}
                    <span className="text-[var(--text-secondary)]">likely unused</span>
                  </span>
                </div>
              </div>
            ) : (
              <NoUsage />
            )}
          </Loadable>
        </Tile>
      </div>
      <div className="col-span-3 flex min-h-0 flex-col gap-3">
        <WorktreeAccordion model={model} />
        <QueueHero model={model} />
      </div>
    </div>
  );
}
