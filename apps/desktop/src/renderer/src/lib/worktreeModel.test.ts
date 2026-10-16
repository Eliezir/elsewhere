import { describe, expect, it } from "vitest";
import type { Worktree } from "@/data/types";
import { ageDays, groupByProject, matchesMode, stateOf, suggestLabel } from "./worktreeModel";

const NOW = 1_800_000_000;
const DAY = 86400;

function tree(over: Partial<Worktree>): Worktree {
  return { id: "x", name: "x", repo: "app", branch: "main", head: "abc", location: "mac", path: "/p", modified: 0, ahead: 0, behind: 0, lastActive: NOW, sessions: [], hasEnv: false, isMain: false, merged: false, upstreamGone: false, ...over };
}

describe("states and filters", () => {
  it("tells recent, idle, old, merged and both apart", () => {
    expect(stateOf(tree({ lastActive: NOW - DAY }), NOW, 30)).toBe("active");
    expect(stateOf(tree({ lastActive: NOW - 10 * DAY }), NOW, 30)).toBe("idle");
    expect(stateOf(tree({ lastActive: NOW - 40 * DAY }), NOW, 30)).toBe("stale");
    expect(stateOf(tree({ lastActive: NOW - 5 * DAY, merged: true }), NOW, 30)).toBe("merged");
    expect(stateOf(tree({ lastActive: NOW - 2 * DAY, merged: true }), NOW, 30)).toBe("active");
    expect(stateOf(tree({ lastActive: NOW - 40 * DAY, merged: true }), NOW, 30)).toBe("both");
    expect(stateOf(tree({ lastActive: NOW - 400 * DAY, isMain: true }), NOW, 30)).toBe("active");
  });

  it("filters by date, merged, either or both", () => {
    const old = tree({ lastActive: NOW - 90 * DAY });
    const merged = tree({ merged: true, lastActive: NOW - 5 * DAY });
    const both = tree({ lastActive: NOW - 90 * DAY, merged: true });
    const fresh = tree({});
    const all = [old, merged, both, fresh];
    const pick = (mode: Parameters<typeof matchesMode>[1]) => all.filter((entry) => matchesMode(entry, mode, NOW, 30));
    expect(pick("old")).toEqual([old, both]);
    expect(pick("merged")).toEqual([merged, both]);
    expect(pick("either")).toEqual([old, merged, both]);
    expect(pick("both")).toEqual([both]);
    expect(pick("all")).toHaveLength(4);
  });

  it("counts age in whole days", () => {
    expect(ageDays({ lastActive: NOW - 3 * DAY - 100 }, NOW)).toBe(3);
  });
});

describe("groupByProject", () => {
  it("sums sizes, counts states and puts the heaviest project first", () => {
    const groups = groupByProject([tree({ id: "a", repo: "small" }), tree({ id: "b", repo: "big", lastActive: NOW - 60 * DAY }), tree({ id: "c", repo: "big" })], { a: 10, b: 500, c: 100 }, NOW, 30);
    expect(groups.map((group) => group.repo)).toEqual(["big", "small"]);
    expect(groups[0]?.bytes).toBe(600);
    expect(groups[0]?.states.stale).toBe(1);
  });
});

describe("suggestLabel", () => {
  it("suggests a name from the branch when the folder name is generated", () => {
    expect(suggestLabel({ name: "agent-a6879b53a2c811d4b", branch: "eliezir/333-auto-mode-prototype", isMain: false })).toEqual({ label: "Auto mode prototype", source: "branch" });
    expect(suggestLabel({ name: "t3-42a743f6", branch: "docs/check-latest-release", isMain: false })).toEqual({ label: "Check latest release", source: "branch" });
    expect(suggestLabel({ name: "lisbon", branch: "feature/new-pipeline-ui", isMain: false })?.label).toBe("New pipeline UI");
  });
  it("falls back to the first session title", () => {
    expect(suggestLabel({ name: "lyon", branch: null, isMain: false }, { title: "Okay, lets start by looking into those issues" })).toEqual({ label: "Okay, lets start by looking into those issues", source: "session" });
  });
  it("leaves meaningful names and main checkouts alone", () => {
    expect(suggestLabel({ name: "vm-companion", branch: "main", isMain: false })).toBeNull();
    expect(suggestLabel({ name: "adt-studio-main", branch: "develop", isMain: true })).toBeNull();
  });
});
