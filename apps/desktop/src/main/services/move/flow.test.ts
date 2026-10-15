import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { appendFile, mkdir, mkdtemp, readFile, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { MoveProgress, MoveRequest } from "@vmc/shared";
import { encodeProjectPath } from "../sessions";
import { runMove } from "./flow";
import { vmPathsFor } from "./paths";
import { localRemote } from "./remote";

process.env.GIT_AUTHOR_NAME = "Test";
process.env.GIT_AUTHOR_EMAIL = "test@example.com";
process.env.GIT_COMMITTER_NAME = "Test";
process.env.GIT_COMMITTER_EMAIL = "test@example.com";

const git = (cwd: string, ...args: string[]) => execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8" }).trim();

async function world() {
  const root = realpathSync(await mkdtemp(join(tmpdir(), "vmc-move-")));
  const macProjects = join(root, "mac-claude");
  const vmHome = join(root, "vm-home");
  await mkdir(vmHome, { recursive: true });
  const repo = join(root, "mac", "demo");
  await mkdir(repo, { recursive: true });
  git(repo, "init", "-q", "-b", "main");
  git(repo, "config", "user.name", "Test");
  git(repo, "config", "user.email", "test@example.com");
  await writeFile(join(repo, "a.txt"), "one\n");
  git(repo, "add", ".");
  git(repo, "commit", "-q", "-m", "init");
  const macPath = join(root, "mac", "wt", "feature");
  git(repo, "worktree", "add", "-q", "-b", "feature", macPath);
  await writeFile(join(macPath, "work.txt"), "unsaved work\n");

  const sessionDir = join(macProjects, encodeProjectPath(macPath));
  await mkdir(sessionDir, { recursive: true });
  await writeFile(join(sessionDir, "s1.jsonl"), `${JSON.stringify({ type: "user", cwd: macPath, message: { content: "Add the export button" } })}\n${JSON.stringify({ type: "assistant", cwd: macPath })}\n`);

  const request: MoveRequest = { direction: "to-vm", target: { host: "vm", user: "dev" }, repo: "demo", name: "feature", branch: "feature", macPath, vmPath: null, includeEnv: false };
  const paths = vmPathsFor(vmHome, "demo", "feature");
  return { root, macProjects, vmHome, macPath, request, paths, remote: localRemote(vmHome) };
}

const quiet = () => undefined;

describe("move to the VM", () => {
  it("commits unsaved work, creates the VM worktree and copies sessions with rewritten paths", async () => {
    const w = await world();
    const events: MoveProgress[] = [];
    const result = await runMove(w.request, w.remote, (event) => events.push(event), w.macProjects);

    expect(result).toMatchObject({ ok: true, vmPath: w.paths.worktree });
    expect(git(w.macPath, "status", "--porcelain")).toBe("");
    expect(git(w.macPath, "log", "-1", "--format=%s")).toBe("WIP: moved to the VM");
    expect(git(w.paths.worktree, "rev-parse", "HEAD")).toBe(git(w.macPath, "rev-parse", "HEAD"));
    expect(git(w.paths.worktree, "rev-parse", "--abbrev-ref", "HEAD")).toBe("feature");
    expect(await readFile(join(w.paths.worktree, "work.txt"), "utf8")).toBe("unsaved work\n");

    const copied = await readFile(join(w.vmHome, ".claude", "projects", encodeProjectPath(w.paths.worktree), "s1.jsonl"), "utf8");
    expect(copied).toContain(w.paths.worktree);
    expect(copied).not.toContain(w.macPath);
    expect(events.filter((event) => event.status === "failed")).toEqual([]);
    expect(events.map((event) => event.step)).toContain("sessions");
  });

  it("refuses to overwrite a VM copy that has new commits", async () => {
    const w = await world();
    await runMove(w.request, w.remote, quiet, w.macProjects);
    await writeFile(join(w.paths.worktree, "vm.txt"), "made on the VM\n");
    git(w.paths.worktree, "add", ".");
    git(w.paths.worktree, "commit", "-q", "-m", "vm work");

    const again = await runMove(w.request, w.remote, quiet, w.macProjects);
    expect(again.ok).toBe(false);
    expect(again.error).toContain("Move it back first");
  });
});

describe("move back to the Mac", () => {
  it("fast-forwards the Mac, and brings back newer sessions rewritten to Mac paths", async () => {
    const w = await world();
    await runMove(w.request, w.remote, quiet, w.macProjects);

    await writeFile(join(w.paths.worktree, "vm.txt"), "made on the VM\n");
    const vmSession = join(w.vmHome, ".claude", "projects", encodeProjectPath(w.paths.worktree), "s1.jsonl");
    await appendFile(vmSession, `${JSON.stringify({ type: "assistant", cwd: w.paths.worktree, message: { content: "done on the VM" } })}\n`);
    const later = new Date(Date.now() + 60_000);
    await utimes(vmSession, later, later);

    const back = await runMove({ ...w.request, direction: "to-mac", vmPath: w.paths.worktree }, w.remote, quiet, w.macProjects);
    expect(back).toMatchObject({ ok: true });
    expect(await readFile(join(w.macPath, "vm.txt"), "utf8")).toBe("made on the VM\n");
    expect(git(w.macPath, "log", "-1", "--format=%s")).toBe("WIP: moved to the Mac");

    const session = await readFile(join(w.macProjects, encodeProjectPath(w.macPath), "s1.jsonl"), "utf8");
    expect(session).toContain("done on the VM");
    expect(session).toContain(w.macPath);
    expect(session).not.toContain(w.paths.worktree);
  });

  it("stops without merging when both sides have new commits", async () => {
    const w = await world();
    await runMove(w.request, w.remote, quiet, w.macProjects);

    await writeFile(join(w.macPath, "mac.txt"), "mac side\n");
    git(w.macPath, "add", ".");
    git(w.macPath, "commit", "-q", "-m", "mac work");
    await writeFile(join(w.paths.worktree, "vm.txt"), "vm side\n");

    const back = await runMove({ ...w.request, direction: "to-mac", vmPath: w.paths.worktree }, w.remote, quiet, w.macProjects);
    expect(back.ok).toBe(false);
    expect(back.error).toContain("both have new commits");
    expect(git(w.macPath, "log", "-1", "--format=%s")).toBe("mac work");
  });

  it("refuses when the Mac worktree has uncommitted changes", async () => {
    const w = await world();
    await runMove(w.request, w.remote, quiet, w.macProjects);
    await writeFile(join(w.paths.worktree, "vm.txt"), "vm side\n");
    await writeFile(join(w.macPath, "dirty.txt"), "uncommitted\n");

    const back = await runMove({ ...w.request, direction: "to-mac", vmPath: w.paths.worktree }, w.remote, quiet, w.macProjects);
    expect(back.ok).toBe(false);
    expect(back.error).toContain("uncommitted");
  });
});
