import { access, stat } from "node:fs/promises";
import { basename, join } from "node:path";
import type { Worktree } from "@vmc/shared";
import { expandHome, git, parseStatus, parseWorktreeList, type RawWorktree } from "./git";
import { listSessions } from "./sessions";

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

const CONCURRENCY = 4;

async function mapLimit<T, R>(items: readonly T[], limit: number, work: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array<R>(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await work(items[index] as T);
    }
  });
  await Promise.all(runners);
  return results;
}

async function describeWorktree(raw: RawWorktree, repo: string): Promise<Worktree | null> {
  if (raw.bare || raw.prunable || !(await exists(raw.path))) return null;
  const [statusText, committed, sessions, hasEnv] = await Promise.all([
    git(raw.path, ["status", "--porcelain=v2", "--branch"]).catch(() => ""),
    git(raw.path, ["log", "-1", "--format=%ct"]).catch(() => "0"),
    listSessions(raw.path),
    exists(join(raw.path, ".env")),
  ]);
  const status = parseStatus(statusText);
  const newestSession = sessions[0]?.lastActive ?? 0;
  return {
    id: `mac:${raw.path}`,
    name: basename(raw.path),
    repo,
    branch: raw.branch,
    head: raw.head,
    location: "mac",
    path: raw.path,
    modified: status.modified,
    ahead: status.ahead,
    behind: status.behind,
    lastActive: Math.max(Number(committed.trim()) || 0, newestSession),
    sessions,
    hasEnv,
  };
}

export async function listMacWorktrees(repoPaths: readonly string[]): Promise<Worktree[]> {
  const seen = new Set<string>();
  const found: Worktree[] = [];
  for (const repoPath of repoPaths) {
    const repo = expandHome(repoPath);
    try {
      if (!(await stat(repo)).isDirectory()) continue;
      const raws = parseWorktreeList(await git(repo, ["worktree", "list", "--porcelain"]));
      const fresh = raws.filter((raw) => !seen.has(raw.path));
      for (const raw of fresh) seen.add(raw.path);
      const described = await mapLimit(fresh, CONCURRENCY, (raw) => describeWorktree(raw, basename(repo)));
      for (const worktree of described) if (worktree) found.push(worktree);
    } catch {
      continue;
    }
  }
  return found.sort((a, b) => b.lastActive - a.lastActive);
}
