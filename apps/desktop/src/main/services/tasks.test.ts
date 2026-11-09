import { describe, expect, it } from "vitest";
import { countTodos, ownerOf, taskFile, templateFor, titleOf } from "./tasks";

describe("task files", () => {
  it("counts open and done checkboxes, including nested ones", () => {
    const md = "# T\n- [ ] one\n- [x] two\n  - [X] three\n* [ ] four\n- not a todo\n[ ] loose\n";
    expect(countTodos(md)).toEqual({ open: 2, done: 2 });
  });

  it("uses the first heading as the title, else the key", () => {
    expect(titleOf("# Reader speed\n\nbody", "ADT-1")).toBe("Reader speed");
    expect(titleOf("no heading", "ADT-1")).toBe("ADT-1");
  });

  it("accepts only TASKS.md directly inside .context/<key> of a known worktree", () => {
    const trees = ["/work/a", "/work/b"];
    expect(ownerOf(taskFile("/work/a", "ADT-1"), trees)).toEqual({ worktree: "/work/a", key: "ADT-1" });
    expect(ownerOf("/work/a/.context/ADT-1/other.md", trees)).toBeNull();
    expect(ownerOf("/work/a/.context/ADT-1/deep/TASKS.md", trees)).toBeNull();
    expect(ownerOf("/work/a/.context/../src/TASKS.md", trees)).toBeNull();
    expect(ownerOf("/etc/passwd", trees)).toBeNull();
    expect(ownerOf("/work/ab/.context/ADT-1/TASKS.md", trees)).toBeNull();
  });

  it("starts a new task from a template with the key as its title", () => {
    expect(titleOf(templateFor("issue-705"), "x")).toBe("issue-705");
    expect(countTodos(templateFor("issue-705")).open).toBe(1);
  });
});
