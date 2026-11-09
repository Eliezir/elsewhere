import type { TaskEntry } from "@vmc/shared";
import { describe, expect, it } from "vitest";
import { checklistOf, filterGroups, groupTasks, suggestedKey, toggleLine } from "./taskModel";

const entry = (key: string, worktree: string, open: number, updatedAt: number, branch: string | null = null): TaskEntry => ({ key, title: `Title ${key}`, repo: "adt-studio", branch, worktree, file: `${worktree}/.context/${key}/TASKS.md`, open, done: 1, updatedAt });

describe("task model", () => {
  it("merges the same key across worktrees and sums the counts", () => {
    const groups = groupTasks([entry("ADT-1", "/a", 2, 10), entry("ADT-1", "/b", 3, 20), entry("ADT-2", "/c", 1, 5)]);
    expect(groups.map((group) => group.key)).toEqual(["ADT-1", "ADT-2"]);
    expect(groups[0]).toMatchObject({ open: 5, done: 2, updatedAt: 20 });
    expect(groups[0]?.threads.map((thread) => thread.worktree)).toEqual(["/b", "/a"]);
  });

  it("searches key, title, branch and repo with every word required", () => {
    const groups = groupTasks([entry("ADT-1", "/a", 1, 1, "feat/reader-speed"), entry("ADT-2", "/b", 1, 2, "fix/tts")]);
    expect(filterGroups(groups, "reader").map((group) => group.key)).toEqual(["ADT-1"]);
    expect(filterGroups(groups, "adt studio")).toHaveLength(2);
    expect(filterGroups(groups, "adt nomatch")).toHaveLength(0);
    expect(filterGroups(groups, "adt-studio fix")).toHaveLength(1);
    expect(filterGroups(groups, "  ")).toHaveLength(2);
  });

  it("lists checkboxes with their line and toggles only that line", () => {
    const md = "# T\n- [ ] one\ntext\n- [x] two\n";
    expect(checklistOf(md)).toEqual([
      { line: 1, text: "one", done: false },
      { line: 3, text: "two", done: true },
    ]);
    expect(toggleLine(md, 1)).toBe("# T\n- [x] one\ntext\n- [x] two\n");
    expect(toggleLine(md, 3)).toBe("# T\n- [ ] one\ntext\n- [ ] two\n");
    expect(toggleLine(md, 99)).toBe(md);
  });

  it("guesses a key from the branch name", () => {
    expect(suggestedKey("feat/ABC-123-login")).toBe("ABC-123");
    expect(suggestedKey("issue-705")).toBe("issue-705");
    expect(suggestedKey("fix/template-inline-headings")).toBe("fix-template-inline-headings");
    expect(suggestedKey(null)).toBe("");
  });
});
