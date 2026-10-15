import { describe, expect, it } from "vitest";
import { staleInfo } from "./stale";

const NOW = 1_800_000_000;
const DAY = 86400;
const base = { lastActive: NOW, merged: false, upstreamGone: false, isMain: false };

describe("staleInfo", () => {
  it("is not stale when recently active", () => {
    expect(staleInfo({ ...base, lastActive: NOW - 5 * DAY }, 30, NOW)).toEqual({ stale: false, reasons: [] });
  });

  it("is stale after the configured idle period", () => {
    const info = staleInfo({ ...base, lastActive: NOW - 45 * DAY }, 30, NOW);
    expect(info.stale).toBe(true);
    expect(info.reasons).toEqual(["No activity for 45 days"]);
  });

  it("flags merged or remote-deleted branches, but not brand-new ones", () => {
    expect(staleInfo({ ...base, lastActive: NOW - 10 * DAY, merged: true }, 30, NOW).reasons).toEqual(["Its branch is already merged"]);
    expect(staleInfo({ ...base, lastActive: NOW - 10 * DAY, upstreamGone: true }, 30, NOW).reasons).toEqual(["Its remote branch was deleted"]);
    expect(staleInfo({ ...base, lastActive: NOW - 3600, merged: true }, 30, NOW).stale).toBe(false);
  });

  it("lists every reason together", () => {
    const info = staleInfo({ ...base, lastActive: NOW - 60 * DAY, merged: true, upstreamGone: true }, 30, NOW);
    expect(info.reasons).toHaveLength(3);
  });

  it("never marks a main checkout as stale", () => {
    expect(staleInfo({ ...base, lastActive: NOW - 400 * DAY, merged: true, isMain: true }, 30, NOW).stale).toBe(false);
  });

  it("ignores worktrees with no recorded activity", () => {
    expect(staleInfo({ ...base, lastActive: 0 }, 30, NOW).stale).toBe(false);
  });
});
