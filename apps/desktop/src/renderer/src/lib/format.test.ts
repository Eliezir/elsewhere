import { describe, expect, it } from "vitest";
import { formatBytes } from "./format";

describe("formatBytes", () => {
  it("picks a readable unit", () => {
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(5.5 * 1024 * 1024)).toBe("5.5 MB");
    expect(formatBytes(420 * 1024 * 1024)).toBe("420 MB");
    expect(formatBytes(1.8 * 1024 * 1024 * 1024)).toBe("1.8 GB");
    expect(formatBytes(37 * 1024 * 1024 * 1024)).toBe("37 GB");
  });
});
