import { describe, expect, it } from "vitest";
import { groupPorts, labelFor, projectFor, relativeTo, serviceLabel, shortPath } from "./ports";

describe("projectFor", () => {
  const trees = ["/home/dev/Developer/adt-studio", "/home/dev/Developer/worktrees/adt-studio/cayenne"];
  it("picks the deepest worktree that contains the working directory", () => {
    expect(projectFor("/home/dev/Developer/worktrees/adt-studio/cayenne/apps/api", trees)).toBe(trees[1]);
    expect(projectFor("/home/dev/Developer/adt-studio", trees)).toBe(trees[0]);
  });
  it("does not match a sibling that only shares a prefix", () => {
    expect(projectFor("/home/dev/Developer/adt-studio-v2/apps", trees)).toBeNull();
    expect(projectFor(null, trees)).toBeNull();
  });
});

describe("shortPath", () => {
  it("abbreviates the home directory", () => {
    expect(shortPath("/home/dev/.npm")).toBe("~/.npm");
    expect(shortPath("/etc/x")).toBe("/etc/x");
  });
});

describe("labelFor", () => {
  it("falls back to the worktrees folder layout when the checkout is unknown", () => {
    expect(labelFor("/home/dev/.t3/worktrees/adt-studio/t3-42a/apps/api", [])).toBe("adt-studio · t3-42a");
    expect(labelFor("/home/dev", [])).toBeNull();
    expect(labelFor("/x/worktrees/a/b", [{ path: "/x/worktrees/a/b", repo: "adt", name: "b" }])).toBe("adt · b");
  });
});

describe("serviceLabel", () => {
  it("names the editor server and trims thread suffixes", () => {
    expect(serviceLabel(3773, "node-MainThread")).toBe("T3 Code server");
    expect(serviceLabel(9000, "node-MainThread")).toBe("node");
  });
});

describe("groupPorts", () => {
  it("groups ports by their worktree root and keeps unknown checkouts apart", () => {
    const ports = [
      { cwd: "/home/dev/.t3/worktrees/adt-studio/t3-1/apps/api", branch: "feat/a", port: 3001 },
      { cwd: "/home/dev/.t3/worktrees/adt-studio/t3-1/apps/studio", branch: "feat/a", port: 5173 },
      { cwd: "/home/dev/Developer/worktrees/other/x/apps/web", branch: "main", port: 4000 },
    ];
    const groups = groupPorts(ports, [{ path: "/home/dev/Developer/worktrees/other/x", repo: "other-repo", name: "x" }]);
    expect(groups.map((group) => [group.repo, group.name, group.ports.map((port) => port.port)])).toEqual([
      ["adt-studio", "t3-1", [3001, 5173]],
      ["other-repo", "x", [4000]],
    ]);
  });
});

describe("relativeTo", () => {
  it("returns the folder inside the root", () => {
    expect(relativeTo("/r/apps/api", "/r")).toBe("apps/api");
    expect(relativeTo("/r", "/r")).toBeNull();
    expect(relativeTo("/x/apps", "/r")).toBeNull();
  });
});
