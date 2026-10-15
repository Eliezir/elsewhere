import type { UsageSnapshot } from "@vmc/shared";
import type { DayUsage, UsageData } from "@/data/types";

const FIVE_HOURS = 5 * 60 * 60;
const WEEK = 7 * 24 * 60 * 60;
const STALE_AFTER_MINUTES = 30;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function forecastUnused(used: number, resetsAt: number, now: number): number | null {
  const elapsed = 1 - (resetsAt - now) / WEEK;
  if (elapsed < 0.05 || elapsed > 1) return null;
  const projected = Math.min(100, used / elapsed);
  return Math.round(Math.max(0, 100 - projected));
}

function dayKey(seconds: number): string {
  const date = new Date(seconds * 1000);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function peaksByDay(samples: UsageSnapshot["samples"], now: number): DayUsage[] {
  return Array.from({ length: 7 }, (_, offset) => {
    const moment = now - (6 - offset) * 86400;
    const key = dayKey(moment);
    const values = samples.filter((sample) => sample.five !== null && dayKey(sample.t) === key).map((sample) => sample.five ?? 0);
    const label = WEEKDAYS[new Date(moment * 1000).getDay()] ?? "";
    return values.length === 0 ? { day: label, percent: 0, hasData: false } : { day: label, percent: Math.round(Math.max(...values)), hasData: true };
  });
}

export function toUsageData(snapshot: UsageSnapshot, now: number): UsageData {
  const { current, samples } = snapshot;
  const five = current?.fiveHour ?? null;
  const seven = current?.sevenDay ?? null;

  const windowSamples = five
    ? samples.filter((sample) => sample.five !== null && sample.t >= five.resetsAt - FIVE_HOURS).map((sample) => sample.five ?? 0)
    : [];
  const series = five ? [...windowSamples, five.usedPercentage] : [];
  const ageMinutes = current ? Math.max(0, Math.round((now - current.updatedAt) / 60)) : null;

  return {
    fiveHour: five ? Math.round(five.usedPercentage) : null,
    fiveHourResets: five ? formatDuration(five.resetsAt - now) : null,
    weekly: seven ? Math.round(seven.usedPercentage) : null,
    weeklyResets: seven ? formatDuration(seven.resetsAt - now) : null,
    unused: seven ? forecastUnused(seven.usedPercentage, seven.resetsAt, now) : null,
    days: peaksByDay(samples, now),
    fiveHourSeries: series.length >= 2 ? series : [],
    updatedAt: current?.updatedAt ?? null,
    ageMinutes,
    stale: ageMinutes !== null && ageMinutes > STALE_AFTER_MINUTES,
    sampleCount: samples.length,
    scoped: (current?.scoped ?? []).map((window) => ({
      id: window.id,
      title: window.title,
      percent: Math.round(window.usedPercentage),
      resets: formatDuration(window.resetsAt - now),
    })),
    source: { kind: snapshot.status.source, error: snapshot.status.error },
  };
}
