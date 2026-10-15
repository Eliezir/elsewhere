import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { encodeProjectPath, titleFromTranscript } from "./sessions";
import { parseSnapshot, snapshotScript } from "./vmSnapshot";

const git = (cwd: string, ...args: string[]) => execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8" });

describe("snapshot script and parser", () => {
  it("lists worktrees, status and sessions from a real repo", async () => {
    const home = realpathSync(await mkdtemp(join(tmpdir(), "vmc-home-")));
    const repo = join(home, "Developer", "demo");
    await mkdir(repo, { recursive: true });
    git(repo, "init", "-q", "-b", "main");
    git(repo, "config", "user.email", "t@example.com");
    git(repo, "config", "user.name", "t");
    await writeFile(join(repo, "a.txt"), "one\n");
    git(repo, "add", ".");
    git(repo, "commit", "-q", "-m", "init");
    const wt = join(home, "Developer", "demo-worktrees", "feature");
    git(repo, "worktree", "add", "-q", "-b", "feature", wt);
    await writeFile(join(wt, "b.txt"), "changed\n");
    await writeFile(join(wt, ".env"), "X=1\n");

    const sessions = join(home, ".claude", "projects", encodeProjectPath(wt));
    await mkdir(sessions, { recursive: true });
    const lines = [JSON.stringify({ type: "user", message: { content: "Add the export button" } }), JSON.stringify({ type: "assistant", message: { content: "ok" } })];
    await writeFile(join(sessions, "s1.jsonl"), `${lines.join("\n")}\n`);

    const output = execFileSync("sh", ["-s"], { input: snapshotScript(["~/Developer/demo", "~/Developer/missing"]), env: { ...process.env, HOME: home }, encoding: "utf8" });
    const { worktrees } = parseSnapshot(output);
    expect(worktrees.map((entry) => entry.name).sort()).toEqual(["demo", "feature"]);
    const feature = worktrees.find((entry) => entry.name === "feature");
    expect(feature).toMatchObject({ branch: "feature", location: "vm", modified: 2, hasEnv: true, repo: "demo" });
    expect(feature?.sessions[0]).toMatchObject({ id: "s1", title: "Add the export button", messages: 2 });
  });
});

describe("parseSnapshot health", () => {
  it("derives CPU, memory and disk from the raw readings", () => {
    const output = ["@@LOAD 0.50", "@@CORES 2", "@@MEM 11700 1200", "@@DISK 100663296 6291456", "@@UPTIME 7200", "@@CLAUDE yes", "@@GIT 2.43.0"].join("\n");
    expect(parseSnapshot(output).health).toEqual({
      cpu: 25,
      cores: 2,
      memUsedGb: 1.2,
      memTotalGb: 11,
      diskUsedGb: 6,
      diskTotalGb: 96,
      uptimeSeconds: 7200,
      claudeInstalled: true,
      gitVersion: "2.43.0",
    });
  });

  it("returns null health when the VM output is incomplete", () => {
    expect(parseSnapshot("@@LOAD x").health).toBeNull();
  });
});

describe("titleFromTranscript with a truncated line", () => {
  it("recovers the start of the message", () => {
    const line = '{"type":"user","message":{"role":"user","content":"Please review the translation gaps in the es catalog and fix th';
    expect(titleFromTranscript(line)).toContain("Please review the translation gaps");
  });
});
