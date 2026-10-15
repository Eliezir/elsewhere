import { describe, expect, it } from "vitest";
import { labelFor, projectFor, serviceLabel, shortPath } from "./ports";

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
