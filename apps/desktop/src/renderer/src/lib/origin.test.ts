import { describe, expect, it } from "vitest";
import { originOf, toolFor } from "./origin";

const tree = { name: "accra", location: "mac" as const, isMain: false };

describe("originOf", () => {
  it("recognises Conductor workspaces and names the workspace", () => {
    const origin = originOf({ ...tree, path: "/Users/me/conductor/workspaces/adt-studio-v1/accra" });
    expect(origin).toEqual({ kind: "conductor", label: "Conductor", detail: "workspace accra" });
    expect(toolFor(origin)).toBe("conductor");
  });

  it("recognises T3 Code worktrees by path, or by a known thread", () => {
    expect(originOf({ ...tree, path: "/Users/me/.t3/worktrees/proj/t3code-ab12" }).kind).toBe("t3code");
    const viaThread = originOf({ ...tree, path: "/Users/me/elsewhere/x" }, true);
    expect(viaThread).toEqual({ kind: "t3code", label: "T3 Code", detail: "has a thread" });
  });

  it("recognises Claude Code agent worktrees, which can't be opened in the other tools", () => {
    const origin = originOf({ ...tree, path: "/Users/me/repo/.claude/worktrees/agent-1" });
    expect(origin.kind).toBe("claude");
    expect(toolFor(origin)).toBeNull();
  });

  it("separates main checkouts from manual worktrees and VM worktrees", () => {
    expect(originOf({ ...tree, path: "/Users/me/Developer/repo", isMain: true }).kind).toBe("main");
    expect(originOf({ ...tree, path: "/Users/me/adt-review/333" }).kind).toBe("manual");
    expect(originOf({ ...tree, location: "vm", path: "/home/dev/Developer/worktrees/repo/x" })).toEqual({ kind: "vm", label: "The VM", detail: "moved with Elsewhere" });
  });
});
