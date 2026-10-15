import { describe, expect, it } from "vitest";
import { syncPlan } from "./sync";

const base = { macOnly: 0, vmOnly: 0, macModified: 0, vmModified: 0 };

describe("syncPlan", () => {
  it("is in sync when nothing differs", () => {
    expect(syncPlan(base).kind).toBe("in-sync");
  });
  it("points at the side with new commits or unsaved changes", () => {
    expect(syncPlan({ ...base, macOnly: 2 })).toEqual({ kind: "mac-ahead", message: "The Mac copy is ahead of the VM copy by 2 new commits." });
    expect(syncPlan({ ...base, vmModified: 3 })).toEqual({ kind: "vm-ahead", message: "The VM copy is ahead of the Mac copy by 3 unsaved changes." });
    expect(syncPlan({ ...base, vmOnly: 1, vmModified: 1 }).message).toContain("1 new commit and 1 unsaved change");
  });
  it("refuses to pick a direction when both sides changed", () => {
    expect(syncPlan({ ...base, macOnly: 1, vmOnly: 1 }).kind).toBe("both-changed");
    expect(syncPlan({ ...base, macModified: 1, vmOnly: 1 }).kind).toBe("both-changed");
  });
});
