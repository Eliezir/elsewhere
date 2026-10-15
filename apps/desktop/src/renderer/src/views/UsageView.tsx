import { AreaChart, BigNumber, ColumnChart, HalfGauge, Meter } from "@/components/charts";
import { Pill, Tile } from "@/components/Tile";
import { useUsage } from "@/data/hooks";
import { useSettings } from "@/lib/settings";

const TASK_COST = 6;

export function UsageView() {
  const { data: usage } = useUsage();
  const [settings] = useSettings();

  if (!usage) return null;

  const releasable = Math.max(0, Math.floor(usage.unused / TASK_COST));
  const underCap = usage.fiveHour < settings.pacerCap;

  return (
    <div className="grid h-full grid-cols-12 grid-rows-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-3">
      <Tile className="col-span-4" title="5-hour window" action={<Pill>{`resets in ${usage.fiveHourResets}`}</Pill>}>
        <div className="flex min-h-0 flex-1 flex-col justify-between">
          <BigNumber value={String(usage.fiveHour)} unit="%" />
          <div className="my-3 min-h-0 flex-1">
            <AreaChart values={usage.fiveHourSeries} color="var(--accent)" />
          </div>
          <Meter value={usage.fiveHour} />
          <div className="mt-2 text-xs text-[var(--text-secondary)]">{`Pacer holds new tasks above ${settings.pacerCap}%`}</div>
        </div>
      </Tile>
      <Tile className="col-span-4" index={1} title="Weekly allowance" action={<Pill>{`resets in ${usage.weeklyResets}`}</Pill>}>
        <div className="flex min-h-0 flex-1 flex-col items-center justify-between">
          <div className="flex w-full flex-1 items-center justify-center">
            <HalfGauge value={usage.weekly} />
          </div>
          <div className="text-center">
            <span className="text-3xl font-medium">{usage.weekly}%</span>
            <span className="ml-1.5 text-xs text-[var(--text-secondary)]">of the week used</span>
          </div>
        </div>
      </Tile>
      <Tile className="col-span-4" tone="light" index={2} title="Forecast" action={<Pill tone={underCap ? "ok" : "warn"}>{underCap ? "room to run" : "holding"}</Pill>}>
        <div className="flex min-h-0 flex-1 flex-col justify-between">
          <BigNumber value={String(usage.unused)} unit="% likely unused" />
          <p className="my-3 text-sm leading-relaxed text-[var(--text-secondary)]">
            {`If nothing else runs, about ${usage.unused}% of this week's allowance expires in ${usage.weeklyResets}. That's room for roughly ${releasable} queued tasks.`}
          </p>
          <div className="rounded-2xl bg-[var(--inset)] px-3 py-2.5 text-xs text-[var(--text-secondary)]">
            {underCap
              ? "The pacer will release waiting tasks while the 5-hour window stays under its cap."
              : "The 5-hour window is above the cap, so waiting tasks stay queued until it resets."}
          </div>
        </div>
      </Tile>
      <Tile className="col-span-8" index={3} title="Last 7 days" action={<Pill>peak day Mon</Pill>}>
        <div className="min-h-0 flex-1">
          <ColumnChart items={usage.days.map((day) => ({ label: day.day, value: day.percent }))} highlight={usage.days.length - 1} />
        </div>
      </Tile>
      <Tile className="col-span-4" index={4} title="By model this week">
        <div className="flex flex-1 flex-col justify-around">
          {usage.byModel.map((model) => (
            <div key={model.name}>
              <div className="mb-1.5 flex justify-between">
                <span>{model.name}</span>
                <span className="tabular-nums text-[var(--text-secondary)]">{model.percent}%</span>
              </div>
              <Meter value={model.percent} />
            </div>
          ))}
        </div>
      </Tile>
    </div>
  );
}
