import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AreaChart, BigNumber, ColumnChart, HalfGauge, Meter } from "@/components/charts";
import { Button } from "@/components/controls";
import { Pill, Tile } from "@/components/Tile";
import { useUsage } from "@/data/hooks";
import { useSettings } from "@/lib/settings";
import { NoUsage } from "./overview/parts";

const TASK_COST = 6;

const SOURCE_LABEL = {
  oauth: "Claude usage API",
  statusline: "Claude Code status line",
  none: "Not connected",
} as const;

function freshness(ageMinutes: number | null, stale: boolean): { label: string; tone: "ok" | "warn" | "neutral" } {
  if (ageMinutes === null) return { label: "no data yet", tone: "neutral" };
  if (stale) return { label: `stale · ${ageMinutes} min ago`, tone: "warn" };
  return { label: ageMinutes < 1 ? "live" : `live · ${ageMinutes} min ago`, tone: "ok" };
}

export function UsageView() {
  const { data: usage } = useUsage();
  const [settings] = useSettings();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  if (!usage) return null;

  const refresh = () => {
    setRefreshing(true);
    void window.api
      .refreshUsage()
      .then(() => queryClient.invalidateQueries({ queryKey: ["usage"] }))
      .finally(() => setRefreshing(false));
  };

  const { fiveHour, weekly, unused } = usage;
  const releasable = unused === null ? null : Math.max(0, Math.floor(unused / TASK_COST));
  const underCap = fiveHour !== null && fiveHour < settings.pacerCap;
  const status = freshness(usage.ageMinutes, usage.stale);
  const peak = usage.days.filter((day) => day.hasData).sort((a, b) => b.percent - a.percent)[0];

  return (
    <div className="grid h-full grid-cols-12 grid-rows-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-3">
      <Tile className="col-span-4" title="5-hour window" action={usage.fiveHourResets && <Pill>{`resets in ${usage.fiveHourResets}`}</Pill>}>
        {fiveHour === null ? (
          <NoUsage />
        ) : (
          <div className="flex min-h-0 flex-1 flex-col justify-between">
            <BigNumber value={String(fiveHour)} unit="%" />
            <div className="my-3 min-h-0 flex-1">
              {usage.fiveHourSeries.length >= 2 ? (
                <AreaChart values={usage.fiveHourSeries} color="var(--accent)" />
              ) : (
                <p className="text-xs text-[var(--text-muted)]">Collecting samples, one every five minutes.</p>
              )}
            </div>
            <Meter value={fiveHour} />
            <div className="mt-2 text-xs text-[var(--text-secondary)]">{`Pacer holds new tasks above ${settings.pacerCap}%`}</div>
          </div>
        )}
      </Tile>
      <Tile className="col-span-4" index={1} title="Weekly allowance" action={usage.weeklyResets && <Pill>{`resets in ${usage.weeklyResets}`}</Pill>}>
        {weekly === null ? (
          <NoUsage />
        ) : (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-between">
            <div className="flex w-full flex-1 items-center justify-center">
              <HalfGauge value={weekly} />
            </div>
            <div className="text-center">
              <span className="text-3xl font-medium">{weekly}%</span>
              <span className="ml-1.5 text-xs text-[var(--text-secondary)]">of the week used</span>
            </div>
          </div>
        )}
      </Tile>
      <Tile
        className="col-span-4"
        tone="light"
        index={2}
        title="Forecast"
        action={fiveHour !== null && <Pill tone={underCap ? "ok" : "warn"}>{underCap ? "room to run" : "holding"}</Pill>}
      >
        {unused === null || releasable === null ? (
          <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
            {weekly === null ? "The forecast starts once a weekly limit has been recorded." : "Too early in the week to forecast. Check back after a day of use."}
          </p>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col justify-between">
            <BigNumber value={String(unused)} unit="% likely unused" />
            <p className="my-3 text-sm leading-relaxed text-[var(--text-secondary)]">
              {`At this pace about ${unused}% of this week's allowance expires in ${usage.weeklyResets}. That's room for roughly ${releasable} queued tasks.`}
            </p>
            <div className="rounded-2xl bg-[var(--inset)] px-3 py-2.5 text-xs text-[var(--text-secondary)]">
              {underCap
                ? "The pacer will release waiting tasks while the 5-hour window stays under its cap."
                : "The 5-hour window is above the cap, so waiting tasks stay queued until it resets."}
            </div>
          </div>
        )}
      </Tile>
      <Tile className="col-span-8" index={3} title="Peak 5-hour usage by day" action={peak && <Pill>{`peak day ${peak.day}`}</Pill>}>
        {usage.sampleCount === 0 ? (
          <p className="text-xs text-[var(--text-muted)]">History fills in as you work. One sample is saved every five minutes while a Claude Code session is running.</p>
        ) : (
          <div className="min-h-0 flex-1">
            <ColumnChart items={usage.days.map((day) => ({ label: day.day, value: day.percent }))} highlight={usage.days.length - 1} />
          </div>
        )}
      </Tile>
      <Tile className="col-span-4" index={4} title={usage.scoped.length > 0 ? "Weekly by model" : "Data source"} action={<Pill tone={status.tone}>{status.label}</Pill>}>
        <div className="flex min-h-0 flex-1 flex-col justify-between gap-3">
          {usage.scoped.length > 0 && (
            <div className="flex flex-1 flex-col justify-around">
              {usage.scoped.map((window) => (
                <div key={window.id}>
                  <div className="mb-1.5 flex justify-between">
                    <span>{window.title}</span>
                    <span className="tabular-nums text-[var(--text-secondary)]">{`${window.percent}% · resets in ${window.resets}`}</span>
                  </div>
                  <Meter value={window.percent} />
                </div>
              ))}
            </div>
          )}
          <div className="space-y-2 text-xs">
            <div className="flex justify-between gap-3">
              <span className="text-[var(--text-secondary)]">Source</span>
              <span>{SOURCE_LABEL[usage.source.kind]}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-[var(--text-secondary)]">Samples saved</span>
              <span className="tabular-nums">{usage.sampleCount}</span>
            </div>
            {usage.source.error && <p className="leading-relaxed text-[var(--warn)]">{usage.source.error}</p>}
            {usage.source.detail && <p className="break-words leading-relaxed text-[var(--text-muted)]">{usage.source.detail}</p>}
            <Button onClick={refresh} disabled={refreshing} className="w-full !py-1.5">
              {refreshing ? "Refreshing…" : "Refresh now"}
            </Button>
          </div>
        </div>
      </Tile>
    </div>
  );
}
