import { describe, expect, it } from "vitest";
import { parseCounts } from "./twin";

describe("parseCounts", () => {
  it("reads the left and right commit counts", () => {
    expect(parseCounts("3\t1\n")).toEqual({ macOnly: 3, vmOnly: 1 });
    expect(parseCounts("0 0")).toEqual({ macOnly: 0, vmOnly: 0 });
  });
  it("rejects anything else", () => {
    expect(parseCounts("")).toBeNull();
    expect(parseCounts("a b")).toBeNull();
  });
});
