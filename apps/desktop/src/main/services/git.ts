import { execFile } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

export interface RawWorktree {
  path: string;
  head: string;
  branch: string | null;
  bare: boolean;
  prunable: boolean;
}

export interface WorktreeStatus {
  modified: number;
  ahead: number;
  behind: number;
}

export function expandHome(path: string): string {
  return path.startsWith("~/") ? join(homedir(), path.slice(2)) : path;
}

export function parseWorktreeList(text: string): RawWorktree[] {
  const result: RawWorktree[] = [];
  for (const block of text.split("\n\n")) {
    const lines = block.split("\n").filter((line) => line !== "");
    const path = lines.find((line) => line.startsWith("worktree "))?.slice("worktree ".length);
    if (!path) continue;
    const branchRef = lines.find((line) => line.startsWith("branch "))?.slice("branch ".length) ?? null;
    result.push({
      path,
      head: lines.find((line) => line.startsWith("HEAD "))?.slice("HEAD ".length) ?? "",
      branch: branchRef?.replace(/^refs\/heads\//, "") ?? null,
      bare: lines.includes("bare"),
      prunable: lines.some((line) => line === "prunable" || line.startsWith("prunable ")),
    });
  }
  return result;
}

export function parseStatus(text: string): WorktreeStatus {
  let modified = 0;
  let ahead = 0;
  let behind = 0;
  for (const line of text.split("\n")) {
    if (line.startsWith("# branch.ab ")) {
      const match = /\+(\d+) -(\d+)/.exec(line);
      ahead = Number(match?.[1] ?? 0);
      behind = Number(match?.[2] ?? 0);
    } else if (line !== "" && !line.startsWith("#")) {
      modified += 1;
    }
  }
  return { modified, ahead, behind };
}

export async function git(cwd: string, args: readonly string[], timeout = 15000): Promise<string> {
  const { stdout } = await run("git", ["-C", cwd, ...args], {
    timeout,
    maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, GIT_OPTIONAL_LOCKS: "0", GIT_TERMINAL_PROMPT: "0" },
  });
  return stdout;
}
