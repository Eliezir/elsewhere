import { execFileSync } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { MoveProgress, MoveRequest, VmTarget } from "@vmc/shared";
import { encodeProjectPath } from "../sessions";
import { runSsh, shq } from "../ssh";
import { deleteVmWorktree } from "../cleanup";
import { parseDu } from "../sizes";
import { runMove } from "./flow";
import { vmPathsFor } from "./paths";
import { sshRemote } from "./remote";

const live = process.env.VMC_LIVE === "1";
const target: VmTarget = { host: process.env.VMC_LIVE_HOST ?? "", user: process.env.VMC_LIVE_USER ?? "dev" };

process.env.GIT_AUTHOR_NAME = "Live Test";
process.env.GIT_AUTHOR_EMAIL = "live@example.com";
process.env.GIT_COMMITTER_NAME = "Live Test";
process.env.GIT_COMMITTER_EMAIL = "live@example.com";

const git = (cwd: string, ...args: string[]) => execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8" }).trim();

describe.skipIf(!live)("move against the real VM", () => {
  it("moves a throwaway project to the VM and back", async () => {
    const stamp = Date.now();
    const repoName = `vmclive${stamp}`;
    const root = realpathSync(await mkdtemp(join(tmpdir(), "vmc-live-")));
    const macProjects = join(root, "mac-claude");
    const repo = join(root, repoName);
    await mkdir(repo, { recursive: true });
    git(repo, "init", "-q", "-b", "main");
    git(repo, "config", "user.name", "Live Test");
    git(repo, "config", "user.email", "live@example.com");
    await writeFile(join(repo, "a.txt"), "one\n");
    git(repo, "add", ".");
    git(repo, "commit", "-q", "-m", "init");
    const macPath = join(root, "wt", "feature");
    git(repo, "worktree", "add", "-q", "-b", "feature", macPath);
    await writeFile(join(macPath, "work.txt"), "unsaved work\n");
    const sessionDir = join(macProjects, encodeProjectPath(macPath));
    await mkdir(sessionDir, { recursive: true });
    await writeFile(join(sessionDir, "s1.jsonl"), `${JSON.stringify({ type: "user", cwd: macPath, message: { content: "live test session" } })}\n${JSON.stringify({ type: "assistant", cwd: macPath })}\n`);

    const remote = sshRemote(target);
    const home = await remote.home();
    expect(home).not.toBe("");
    const paths = vmPathsFor(home, repoName, "feature");
    const request: MoveRequest = { direction: "to-vm", target, repo: repoName, name: "feature", branch: "feature", macPath, vmPath: null, includeEnv: false, removeSource: false };
    const events: MoveProgress[] = [];
    const cleanup = () =>
      runSsh(target, `rm -rf ${shq(paths.hub)} ${shq(`${home}/Developer/worktrees/${repoName}`)} ${shq(`${home}/.claude/projects/${encodeProjectPath(paths.worktree)}`)}`, { timeout: 60000 });

    try {
      const result = await runMove(request, remote, (event) => events.push(event), macProjects);
      expect(result.error).toBeNull();
      expect(result.ok).toBe(true);

      const check = await runSsh(
        target,
        `cd ${shq(paths.worktree)} && git rev-parse HEAD && git log -1 --format=%s && cat work.txt && cat ${shq(`${home}/.claude/projects/${encodeProjectPath(paths.worktree)}/s1.jsonl`)} | head -1`,
        { timeout: 60000 },
      );
      expect(check.code).toBe(0);
      expect(check.stdout).toContain(git(macPath, "rev-parse", "HEAD"));
      expect(check.stdout).toContain("WIP: moved to the VM");
      expect(check.stdout).toContain("unsaved work");
      expect(check.stdout).toContain(paths.worktree);
      expect(check.stdout).not.toContain(macPath);

      const edit = await runSsh(target, `cd ${shq(paths.worktree)} && echo "made on the VM" > vm.txt`, { timeout: 60000 });
      expect(edit.code).toBe(0);
      const back = await runMove({ ...request, direction: "to-mac", vmPath: paths.worktree }, remote, (event) => events.push(event), macProjects);
      expect(back.error).toBeNull();
      expect(back.ok).toBe(true);
      expect(await readFile(join(macPath, "vm.txt"), "utf8")).toBe("made on the VM\n");
      expect(events.filter((event) => event.status === "failed")).toEqual([]);

      const du = await runSsh(target, `du -sk ${shq(paths.worktree)} 2>/dev/null`, { timeout: 60000 });
      expect(parseDu(du.stdout)[paths.worktree]).toBeGreaterThan(0);

      await runSsh(target, `cd ${shq(paths.worktree)} && echo dirty > dirty.txt`, { timeout: 60000 });
      const refused = await deleteVmWorktree({ location: "vm", target, path: paths.worktree, branch: "feature", repo: repoName, force: false, deleteBranch: false, deleteSessions: false });
      expect(refused).toMatchObject({ ok: false, needsForce: true });

      const removed = await deleteVmWorktree({ location: "vm", target, path: paths.worktree, branch: "feature", repo: repoName, force: true, deleteBranch: true, deleteSessions: true });
      expect(removed.error).toBeNull();
      expect(removed.ok).toBe(true);
      const gone = await runSsh(target, `[ ! -d ${shq(paths.worktree)} ] && [ ! -d ${shq(`${home}/.claude/projects/${encodeProjectPath(paths.worktree)}`)} ] && echo gone`, { timeout: 60000 });
      expect(gone.stdout).toContain("gone");
    } finally {
      await cleanup();
    }
  }, 600000);

  it("sends a throwaway project and removes the Mac copy once the VM copy is verified", async () => {
    const stamp = Date.now() + 1;
    const repoName = `vmclive${stamp}`;
    const root = realpathSync(await mkdtemp(join(tmpdir(), "vmc-live2-")));
    const repo = join(root, repoName);
    await mkdir(repo, { recursive: true });
    git(repo, "init", "-q", "-b", "main");
    git(repo, "config", "user.name", "Live Test");
    git(repo, "config", "user.email", "live@example.com");
    await writeFile(join(repo, "a.txt"), "one\n");
    git(repo, "add", ".");
    git(repo, "commit", "-q", "-m", "init");
    const macPath = join(root, "wt", "feature");
    git(repo, "worktree", "add", "-q", "-b", "feature", macPath);
    await writeFile(join(macPath, "work.txt"), "unsaved work\n");

    const remote = sshRemote(target);
    const home = await remote.home();
    const paths = vmPathsFor(home, repoName, "feature");
    const request: MoveRequest = { direction: "to-vm", target, repo: repoName, name: "feature", branch: "feature", macPath, vmPath: null, includeEnv: false, removeSource: true };
    try {
      const result = await runMove(request, remote, () => undefined, join(root, "claude"));
      expect(result.error).toBeNull();
      expect(result.note).toContain("The Mac copy was removed.");
      expect(existsSync(macPath)).toBe(false);
      const check = await runSsh(target, `cd ${shq(paths.worktree)} && cat work.txt && git log -1 --format=%s`, { timeout: 60000 });
      expect(check.stdout).toContain("unsaved work");
      expect(check.stdout).toContain("WIP: moved to the VM");
    } finally {
      await runSsh(target, `rm -rf ${shq(paths.hub)} ${shq(`${home}/Developer/worktrees/${repoName}`)}`, { timeout: 60000 });
    }
  }, 600000);

  for (const scenario of ["with-env", "no-env"] as const) {
    it(`sends with the .env option on (${scenario})`, async () => {
      const repoName = `vmclive${Date.now()}${scenario === "with-env" ? "a" : "b"}`;
      const root = realpathSync(await mkdtemp(join(tmpdir(), "vmc-live-env-")));
      const repo = join(root, repoName);
      await mkdir(repo, { recursive: true });
      git(repo, "init", "-q", "-b", "main");
      git(repo, "config", "user.name", "Live Test");
      git(repo, "config", "user.email", "live@example.com");
      await writeFile(join(repo, "a.txt"), "one\n");
      git(repo, "add", ".");
      git(repo, "commit", "-q", "-m", "init");
      const macPath = join(root, "wt", "feature");
      git(repo, "worktree", "add", "-q", "-b", "feature", macPath);
      if (scenario === "with-env") await writeFile(join(macPath, ".env"), "SECRET=1\n");

      const remote = sshRemote(target);
      const home = await remote.home();
      const paths = vmPathsFor(home, repoName, "feature");
      const request: MoveRequest = { direction: "to-vm", target, repo: repoName, name: "feature", branch: "feature", macPath, vmPath: null, includeEnv: true, removeSource: false };
      const events: MoveProgress[] = [];
      try {
        const result = await runMove(request, remote, (event) => events.push(event), join(root, "claude"));
        expect(events.filter((event) => event.status === "failed")).toEqual([]);
        expect(result.error).toBeNull();
        if (scenario === "with-env") {
          const check = await runSsh(target, `cat ${shq(`${paths.worktree}/.env`)}`, { timeout: 60000 });
          expect(check.stdout).toContain("SECRET=1");
        }
      } finally {
        await runSsh(target, `rm -rf ${shq(paths.hub)} ${shq(`${home}/Developer/worktrees/${repoName}`)}`, { timeout: 60000 });
      }
    }, 600000);
  }

  it("sends the same project twice and keeps the VM free of Mac metadata files", async () => {
    const repoName = `vmclive${Date.now()}c`;
    const root = realpathSync(await mkdtemp(join(tmpdir(), "vmc-live-twice-")));
    const repo = join(root, repoName);
    await mkdir(repo, { recursive: true });
    git(repo, "init", "-q", "-b", "main");
    git(repo, "config", "user.name", "Live Test");
    git(repo, "config", "user.email", "live@example.com");
    await writeFile(join(repo, ".gitignore"), ".env*\n");
    await writeFile(join(repo, "a.txt"), "one\n");
    git(repo, "add", ".");
    git(repo, "commit", "-q", "-m", "init");
    const macPath = join(root, "wt", "feature");
    git(repo, "worktree", "add", "-q", "-b", "feature", macPath);
    await writeFile(join(macPath, ".env"), "SECRET=1\n");
    const sessionDir = join(root, "claude", encodeProjectPath(macPath));
    await mkdir(sessionDir, { recursive: true });
    await writeFile(join(sessionDir, "s1.jsonl"), `${JSON.stringify({ type: "user", cwd: macPath, message: { content: "first" } })}\n${JSON.stringify({ type: "assistant", cwd: macPath })}\n`);

    const remote = sshRemote(target);
    const home = await remote.home();
    const paths = vmPathsFor(home, repoName, "feature");
    const request: MoveRequest = { direction: "to-vm", target, repo: repoName, name: "feature", branch: "feature", macPath, vmPath: null, includeEnv: true, removeSource: false };
    try {
      expect((await runMove(request, remote, () => undefined, join(root, "claude"))).error).toBeNull();
      await writeFile(join(macPath, "later.txt"), "more\n");
      git(macPath, "add", ".");
      git(macPath, "commit", "-q", "-m", "more");
      await writeFile(join(sessionDir, "s2.jsonl"), `${JSON.stringify({ type: "user", cwd: macPath, message: { content: "second" } })}\n${JSON.stringify({ type: "assistant", cwd: macPath })}\n`);
      const second = await runMove(request, remote, () => undefined, join(root, "claude"));
      expect(second.error).toBeNull();
      expect(second.ok).toBe(true);

      const check = await runSsh(
        target,
        `cd ${shq(paths.worktree)} && cat later.txt .env && echo --- && find ${shq(paths.worktree)} ${shq(`${home}/.claude/projects/${encodeProjectPath(paths.worktree)}`)} -name '._*' | wc -l && ls ${shq(`${home}/.claude/projects/${encodeProjectPath(paths.worktree)}`)}`,
        { timeout: 60000 },
      );
      expect(check.stdout).toContain("more");
      expect(check.stdout).toContain("SECRET=1");
      expect(check.stdout).toMatch(/---\n0\n/);
      expect(check.stdout).toContain("s2.jsonl");
    } finally {
      await runSsh(target, `rm -rf ${shq(paths.hub)} ${shq(`${home}/Developer/worktrees/${repoName}`)} ${shq(`${home}/.claude/projects/${encodeProjectPath(paths.worktree)}`)}`, { timeout: 60000 });
    }
  }, 600000);
});
