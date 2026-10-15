import { execFileSync } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { DeleteRequest } from "@vmc/shared";
import { deleteMacWorktree, deleteScript, deleteVmWorktree, parseDeleteOutput, parsePruneOutput, parsePruneScript, pruneMac, pruneScript } from "./cleanup";
import { encodeProjectPath } from "./sessions";
import { runLocal } from "./ssh";

process.env.GIT_AUTHOR_NAME = "Test";
process.env.GIT_AUTHOR_EMAIL = "t@example.com";
process.env.GIT_COMMITTER_NAME = "Test";
process.env.GIT_COMMITTER_EMAIL = "t@example.com";

const git = (cwd: string, ...args: string[]) => execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8" }).trim();

async function setup() {
  const root = realpathSync(await mkdtemp(join(tmpdir(), "vmc-clean-")));
  const repo = join(root, "repo");
  await mkdir(repo, { recursive: true });
  git(repo, "init", "-q", "-b", "main");
  await writeFile(join(repo, "a.txt"), "one\n");
  git(repo, "add", ".");
  git(repo, "commit", "-q", "-m", "init");
  const wt = join(root, "wt", "feature");
  git(repo, "worktree", "add", "-q", "-b", "feature", wt);
  const request = (overrides: Partial<DeleteRequest> = {}): DeleteRequest => ({
    location: "mac",
    target: null,
    path: wt,
    branch: "feature",
    repo: "repo",
    force: false,
    deleteBranch: false,
    deleteSessions: false,
    ...overrides,
  });
  return { root, repo, wt, request, projects: join(root, "claude") };
}

describe("deleteMacWorktree", () => {
  it("removes a clean worktree and keeps the branch by default", async () => {
    const w = await setup();
    const result = await deleteMacWorktree(w.request(), w.projects);
    expect(result).toMatchObject({ ok: true, notes: [] });
    expect(existsSync(w.wt)).toBe(false);
    expect(git(w.repo, "branch", "--list", "feature")).toContain("feature");
  });

  it("deletes the branch only when it is fully merged", async () => {
    const w = await setup();
    const result = await deleteMacWorktree(w.request({ deleteBranch: true }), w.projects);
    expect(result.ok).toBe(true);
    expect(result.notes).toEqual(["Deleted the branch feature."]);

    const second = await setup();
    await writeFile(join(second.wt, "new.txt"), "x\n");
    git(second.wt, "add", ".");
    git(second.wt, "commit", "-q", "-m", "unmerged work");
    const kept = await deleteMacWorktree(second.request({ deleteBranch: true }), second.projects);
    expect(kept.ok).toBe(true);
    expect(kept.notes[0]).toContain("Kept the branch");
    expect(git(second.repo, "branch", "--list", "feature")).toContain("feature");
  });

  it("refuses a worktree with uncommitted changes until forced", async () => {
    const w = await setup();
    await writeFile(join(w.wt, "dirty.txt"), "unsaved\n");
    const refused = await deleteMacWorktree(w.request(), w.projects);
    expect(refused).toMatchObject({ ok: false, needsForce: true });
    expect(existsSync(join(w.wt, "dirty.txt"))).toBe(true);

    const forced = await deleteMacWorktree(w.request({ force: true }), w.projects);
    expect(forced.ok).toBe(true);
    expect(existsSync(w.wt)).toBe(false);
  });

  it("never deletes the main checkout", async () => {
    const w = await setup();
    const result = await deleteMacWorktree(w.request({ path: w.repo, branch: "main" }), w.projects);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("main checkout");
    expect(existsSync(join(w.repo, "a.txt"))).toBe(true);
  });

  it("refuses a folder that is not a worktree", async () => {
    const w = await setup();
    const plain = join(w.root, "plain");
    await mkdir(plain);
    const result = await deleteMacWorktree(w.request({ path: plain }), w.projects);
    expect(result.ok).toBe(false);
    expect(existsSync(plain)).toBe(true);
  });

  it("deletes the matching Claude sessions only when asked, and only inside the projects folder", async () => {
    const w = await setup();
    const sessions = join(w.projects, encodeProjectPath(w.wt));
    await mkdir(sessions, { recursive: true });
    await writeFile(join(sessions, "s1.jsonl"), "{}\n");
    const other = join(w.projects, "-other-project");
    await mkdir(other, { recursive: true });

    const result = await deleteMacWorktree(w.request({ deleteSessions: true }), w.projects);
    expect(result.notes).toContain("Deleted its Claude sessions.");
    expect(existsSync(sessions)).toBe(false);
    expect(existsSync(other)).toBe(true);
  });
});

describe("VM delete script", () => {
  const runHere = () => (script: string) => runLocal("sh", ["-s"], { input: script, timeout: 60000 }).then((result) => result);

  it("runs end to end against a real repo and honours the same safeguards", async () => {
    const w = await setup();
    const exec = runHere();
    await writeFile(join(w.wt, "dirty.txt"), "unsaved\n");
    const refused = await deleteVmWorktree(w.request({ location: "vm" }), exec);
    expect(refused).toMatchObject({ ok: false, needsForce: true });

    const forced = await deleteVmWorktree(w.request({ location: "vm", force: true, deleteBranch: true }), exec);
    expect(forced.ok).toBe(true);
    expect(forced.notes.join(" ")).toContain("Deleted the branch feature");
    expect(existsSync(w.wt)).toBe(false);
  });

  it("refuses the main checkout", async () => {
    const w = await setup();
    const result = await deleteVmWorktree(w.request({ location: "vm", path: w.repo, branch: "main" }), runHere());
    expect(result.ok).toBe(false);
    expect(result.error).toContain("main checkout");
    await rm(w.root, { recursive: true, force: true });
  });

  it("parses the script's status lines", () => {
    expect(parseDeleteOutput("NOTE a\nOK\n", 0)).toEqual({ ok: true, needsForce: false, error: null, notes: ["a"] });
    expect(parseDeleteOutput("NEEDSFORCE\n", 20).needsForce).toBe(true);
    expect(parseDeleteOutput("ERR nope\n", 21).error).toBe("nope");
    expect(parseDeleteOutput("", 0).ok).toBe(false);
  });

  it("quotes hostile paths", () => {
    const script = deleteScript({ path: "/tmp/a'; rm -rf / #", branch: null, force: false, deleteBranch: false, deleteSessions: false });
    expect(script).toContain("'/tmp/a'\\''; rm -rf / #'");
  });
});

describe("prune", () => {
  it("finds and removes worktrees whose folder is gone, leaving real ones alone", async () => {
    const w = await setup();
    const gone = join(w.root, "wt", "gone");
    git(w.repo, "worktree", "add", "-q", "-b", "gone", gone);
    await rm(gone, { recursive: true, force: true });

    const preview = await pruneMac([w.repo], true);
    expect(preview[0]?.items).toEqual(["gone"]);
    expect(existsSync(w.wt)).toBe(true);

    await pruneMac([w.repo], false);
    expect((await pruneMac([w.repo], true))[0]?.items).toEqual([]);
    expect(existsSync(w.wt)).toBe(true);
  });

  it("parses prune output and the VM script's framing", () => {
    expect(parsePruneOutput("Removing worktrees/old: gitdir file points to non-existent location\n")).toEqual(["old"]);
    const framed = "@@REPO /home/dev/Developer/.vmc/demo.git\nRemoving worktrees/x: gone\n@@END\n";
    expect(parsePruneScript(framed)).toEqual([{ location: "vm", repo: "demo", items: ["x"] }]);
    expect(pruneScript(["~/a"], true)).toContain("--dry-run");
  });
});
