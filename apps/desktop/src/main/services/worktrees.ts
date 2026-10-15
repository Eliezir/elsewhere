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

interface BranchFlags {
  merged: Set<string>;
  gone: Set<string>;
  base: string | null;
}

async function baseRef(repo: string): Promise<string | null> {
  const head = await git(repo, ["symbolic-ref", "--short", "refs/remotes/origin/HEAD"]).catch(() => "");
  if (head.trim() !== "") return head.trim();
  for (const candidate of ["origin/main", "main", "origin/develop", "develop"]) {
    const found = await git(repo, ["rev-parse", "--verify", "--quiet", candidate]).catch(() => "");
    if (found.trim() !== "") return candidate;
  }
  return null;
}

export async function branchFlags(repo: string): Promise<BranchFlags> {
  const base = await baseRef(repo);
  const merged = new Set<string>();
  if (base) {
    const out = await git(repo, ["for-each-ref", `--merged=${base}`, "--format=%(refname:short)", "refs/heads"]).catch(() => "");
    for (const line of out.split("\n")) if (line.trim() !== "") merged.add(line.trim());
  }
  const gone = new Set<string>();
  const tracking = await git(repo, ["for-each-ref", "--format=%(refname:short)\t%(upstream:track)", "refs/heads"]).catch(() => "");
  for (const line of tracking.split("\n")) {
    const [name, track] = line.split("\t");
    if (name && track?.includes("gone")) gone.add(name);
  }
  return { merged, gone, base };
}

async function describeWorktree(raw: RawWorktree, repo: string, isMain: boolean, flags: BranchFlags): Promise<Worktree | null> {
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
    isMain,
    merged: raw.branch !== null && flags.merged.has(raw.branch) && !isMain,
    upstreamGone: raw.branch !== null && flags.gone.has(raw.branch),
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
      const flags = await branchFlags(repo);
      const fresh = raws.map((raw, index) => ({ raw, isMain: index === 0 && !raw.bare })).filter((entry) => !seen.has(entry.raw.path));
      for (const entry of fresh) seen.add(entry.raw.path);
      const described = await mapLimit(fresh, CONCURRENCY, (entry) => describeWorktree(entry.raw, basename(repo), entry.isMain, flags));
      for (const worktree of described) if (worktree) found.push(worktree);
    } catch {
      continue;
    }
  }
  return found.sort((a, b) => b.lastActive - a.lastActive);
}
