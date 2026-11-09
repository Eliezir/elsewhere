import { describe, expect, it } from "vitest";
import { changeOver, recordSample } from "./storageHistory";

const HOUR = 3600 * 1000;

describe("storage history", () => {
  it("skips samples that arrive too soon after the last one", () => {
    const first = recordSample({}, "mac", 100, 0);
    expect(recordSample(first, "mac", 90, 5 * 60 * 1000)).toBe(first);
    expect(recordSample(first, "mac", 90, HOUR)["mac"]).toHaveLength(2);
  });

  it("keeps hosts apart and caps the length", () => {
    let history = {};
    for (let i = 0; i < 300; i += 1) history = recordSample(history, "mac", i, i * HOUR);
    history = recordSample(history, "pc", 5, 0);
    expect((history as Record<string, unknown[]>)["mac"]).toHaveLength(240);
    expect((history as Record<string, unknown[]>)["pc"]).toHaveLength(1);
  });

  it("reports the change inside the window, negative when free space shrank", () => {
    const samples = [
      { at: 0, freeBytes: 18 },
      { at: 20 * HOUR, freeBytes: 12 },
      { at: 30 * HOUR, freeBytes: 7 },
    ];
    expect(changeOver(samples, 30 * HOUR, 24 * HOUR)).toBe(-5);
    expect(changeOver(samples.slice(-1), 30 * HOUR, 24 * HOUR)).toBeNull();
    expect(changeOver([], 0, HOUR)).toBeNull();
  });
});

import { formatChange, homeRelative } from "./storageHistory";

describe("storage labels", () => {
  it("shortens home folders on both systems", () => {
    expect(homeRelative("/Users/eliezir/.t3/worktrees")).toBe("~/.t3/worktrees");
    expect(homeRelative("/home/eliezir/trabalho")).toBe("~/trabalho");
    expect(homeRelative("/opt/data")).toBe("/opt/data");
  });

  it("signs the change", () => {
    const bytes = (value: number) => `${value}B`;
    expect(formatChange(-5, bytes)).toBe("−5B");
    expect(formatChange(7, bytes)).toBe("+7B");
  });
});
