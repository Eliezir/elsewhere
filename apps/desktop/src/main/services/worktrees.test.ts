import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseStatus, parseWorktreeList } from "./git";
import { countLines, encodeProjectPath, listSessions, titleFromTranscript } from "./sessions";

describe("parseWorktreeList", () => {
  const text = [
    "worktree /Users/me/repo\nHEAD abc123\nbranch refs/heads/main",
    "worktree /Users/me/wt/feature\nHEAD def456\nbranch refs/heads/eliezir/feature",
    "worktree /Users/me/wt/detached\nHEAD 111222\ndetached",
    "worktree /Users/me/wt/gone\nHEAD 333444\ndetached\nprunable gitdir file points to non-existent location",
    "",
  ].join("\n\n");

  it("reads branches, detached heads and prunable entries", () => {
    const parsed = parseWorktreeList(text);
    expect(parsed.map((entry) => entry.branch)).toEqual(["main", "eliezir/feature", null, null]);
    expect(parsed[2]?.head).toBe("111222");
    expect(parsed[3]?.prunable).toBe(true);
  });
});

describe("parseStatus", () => {
  it("counts changed entries and reads ahead/behind", () => {
    const text = ["# branch.oid abc", "# branch.head main", "# branch.ab +3 -1", "1 .M N... 100644 100644 100644 a b file.ts", "? untracked.txt", ""].join("\n");
    expect(parseStatus(text)).toEqual({ modified: 2, ahead: 3, behind: 1 });
  });

  it("treats a branch without an upstream as in sync", () => {
    expect(parseStatus("# branch.head main\n")).toEqual({ modified: 0, ahead: 0, behind: 0 });
  });
});

describe("encodeProjectPath", () => {
  it("matches Claude's folder naming", () => {
    expect(encodeProjectPath("/Users/eliezirmoreira/.t3/worktrees/x")).toBe("-Users-eliezirmoreira--t3-worktrees-x");
  });
});

describe("titleFromTranscript", () => {
  it("prefers a summary, otherwise the first real user message", () => {
    const user = JSON.stringify({ type: "user", message: { role: "user", content: "Fix the login bug" } });
    const meta = JSON.stringify({ type: "user", message: { role: "user", content: "<command-name>/clear</command-name>" } });
    expect(titleFromTranscript([meta, user].join("\n"))).toBe("Fix the login bug");
    const summary = JSON.stringify({ type: "summary", summary: "Login bug fixed" });
    expect(titleFromTranscript([user, summary].join("\n"))).toBe("Login bug fixed");
  });

  it("uses the last prompt when no user message is readable", () => {
    const line = JSON.stringify({ type: "last-prompt", lastPrompt: "check why arc isnt opening" });
    expect(titleFromTranscript(line)).toBe("check why arc isnt opening");
  });

  it("falls back for an empty transcript", () => {
    expect(titleFromTranscript("")).toBe("Untitled session");
  });
});

describe("listSessions", () => {
  it("reads sessions for a worktree path and skips empty ones", async () => {
    const root = await mkdtemp(join(tmpdir(), "vmc-sessions-"));
    const worktree = "/Users/me/wt/feature";
    const dir = join(root, encodeProjectPath(worktree));
    await mkdir(dir, { recursive: true });
    const lines = [JSON.stringify({ type: "user", message: { content: "Hello there" } }), JSON.stringify({ type: "assistant", message: { content: "Hi" } })];
    await writeFile(join(dir, "aaa.jsonl"), `${lines.join("\n")}\n`);
    await writeFile(join(dir, "empty.jsonl"), "");
    const sessions = await listSessions(worktree, root);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({ id: "aaa", title: "Hello there", messages: 2 });
  });

  it("returns nothing for a folder that doesn't exist", async () => {
    expect(await listSessions("/nope", "/also/nope")).toEqual([]);
  });
});

describe("countLines", () => {
  it("counts newline bytes", () => {
    expect(countLines(Buffer.from("a\nb\nc\n"))).toBe(3);
  });
});
