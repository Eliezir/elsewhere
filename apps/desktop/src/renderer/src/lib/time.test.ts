import { describe, expect, it } from "vitest";
import { timeAgo } from "./time";

const NOW = 1_800_000_000;

describe("timeAgo", () => {
  it("uses the largest sensible unit", () => {
    expect(timeAgo(NOW - 30, NOW)).toBe("just now");
    expect(timeAgo(NOW - 12 * 60, NOW)).toBe("12 min ago");
    expect(timeAgo(NOW - 3 * 3600, NOW)).toBe("3 h ago");
    expect(timeAgo(NOW - 86400, NOW)).toBe("yesterday");
    expect(timeAgo(NOW - 5 * 86400, NOW)).toBe("5 days ago");
  });

  it("handles a missing time", () => {
    expect(timeAgo(0, NOW)).toBe("never");
  });
});
