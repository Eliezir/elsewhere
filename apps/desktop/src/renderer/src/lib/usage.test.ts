import { describe, expect, it } from "vitest";
import type { UsageSnapshot } from "@vmc/shared";
import { forecastUnused, formatDuration, toUsageData } from "./usage";

const NOW = 1_800_000_000;
const DAY = 86400;
const STATUS: UsageSnapshot["status"] = { source: "none", error: null, checkedAt: null };

describe("formatDuration", () => {
  it("picks the two most useful units", () => {
    expect(formatDuration(42 * 60)).toBe("42m");
    expect(formatDuration(3600 + 56 * 60)).toBe("1h 56m");
    expect(formatDuration(DAY + 19 * 3600)).toBe("1d 19h");
    expect(formatDuration(-5)).toBe("0m");
  });
});

describe("forecastUnused", () => {
  it("projects the week's usage linearly", () => {
    expect(forecastUnused(36, NOW + 3.5 * DAY, NOW)).toBe(28);
  });

  it("declines to forecast right after a reset", () => {
    expect(forecastUnused(2, NOW + 6.9 * DAY, NOW)).toBeNull();
  });

  it("never goes below zero", () => {
    expect(forecastUnused(90, NOW + 3.5 * DAY, NOW)).toBe(0);
  });
});

describe("toUsageData", () => {
  it("reports nothing when no limits were recorded", () => {
    const data = toUsageData({ current: null, samples: [], status: STATUS }, NOW);
    expect(data.fiveHour).toBeNull();
    expect(data.weekly).toBeNull();
    expect(data.fiveHourSeries).toEqual([]);
    expect(data.days).toHaveLength(7);
  });

  it("builds the 5-hour series from samples inside the current window", () => {
    const resetsAt = NOW + 2 * 3600;
    const data = toUsageData(
      {
        current: { updatedAt: NOW - 120, fiveHour: { usedPercentage: 30, resetsAt }, sevenDay: null, scoped: [] },
        samples: [
          { t: NOW - 10 * 3600, five: 90, seven: null },
          { t: NOW - 2 * 3600, five: 10, seven: null },
          { t: NOW - 3600, five: 20, seven: null },
        ],
        status: STATUS,
      },
      NOW,
    );
    expect(data.fiveHourSeries).toEqual([10, 20, 30]);
    expect(data.fiveHourResets).toBe("2h 0m");
    expect(data.ageMinutes).toBe(2);
    expect(data.stale).toBe(false);
  });

  it("marks data as stale after half an hour", () => {
    const data = toUsageData(
      { current: { updatedAt: NOW - 45 * 60, fiveHour: null, sevenDay: { usedPercentage: 10, resetsAt: NOW + DAY }, scoped: [] }, samples: [], status: STATUS },
      NOW,
    );
    expect(data.stale).toBe(true);
  });
});
