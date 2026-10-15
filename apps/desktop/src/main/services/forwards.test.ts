import { describe, expect, it } from "vitest";
import { parseOwner } from "./forwards";

describe("parseOwner", () => {
  it("names the command and the folder it runs in", () => {
    expect(parseOwner("p15803\ncnode\n", "p15803\nn/Users/me/.t3/worktrees/lip/t3code-1\n")).toBe("node in t3code-1");
  });
  it("falls back to the command alone, or nothing", () => {
    expect(parseOwner("p1\ncnode\n", "")).toBe("node");
    expect(parseOwner("", "")).toBeNull();
  });
});
