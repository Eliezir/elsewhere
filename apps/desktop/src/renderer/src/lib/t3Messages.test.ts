import { describe, expect, it } from "vitest";
import { describeOpen, t3Status } from "./t3Messages";

describe("t3Status", () => {
  it("explains each state of a project in T3 Code on the VM", () => {
    expect(t3Status(undefined, false)).toContain("no projects");
    expect(t3Status(undefined, true)).toContain("Not in T3 Code");
    expect(t3Status({ threads: [] }, true)).toContain("No conversation yet");
    expect(t3Status({ threads: [{}] }, true)).toBe("In T3 Code on the VM · 1 conversation.");
    expect(t3Status({ threads: [{}, {}] }, true)).toContain("2 conversations");
  });
});

describe("describeOpen", () => {
  it("tells you what happened and what to do next", () => {
    expect(describeOpen({ ok: true, opened: "thread", copied: false, projectExists: true, error: null })).toContain("latest conversation");
    expect(describeOpen({ ok: true, opened: "app", copied: true, projectExists: false, error: null })).toContain("clipboard");
    expect(describeOpen({ ok: true, opened: "app", copied: true, projectExists: true, error: null })).toContain("Start a new conversation");
    expect(describeOpen({ ok: false, opened: null, copied: false, projectExists: false, error: "T3 Code isn't installed." })).toBe("T3 Code isn't installed.");
  });
});
