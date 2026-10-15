import { execFile } from "node:child_process";
import { realpath, rm, stat } from "node:fs/promises";
import { basename, isAbsolute, join, resolve, sep } from "node:path";
import { promisify } from "node:util";
import type { DeleteRequest, DeleteResult, PruneEntry, PruneResult, VmTarget } from "@vmc/shared";
import { expandHome, git, parseWorktreeList } from "./git";
import { encodeProjectPath, projectsDir } from "./sessions";
import { describeSshFailure, runSsh, shq } from "./ssh";

const run = promisify(execFile);
const NEEDS_FORCE = /modified or untracked|use --force|contains modified/i;

function fail(error: string, needsForce = false): DeleteResult {
  return { ok: false, needsForce, error, notes: [] };
}

async function gitDir(common: string, args: readonly string[]): Promise<string> {
  const { stdout } = await run("git", ["--git-dir", common, ...args], { timeout: 60000, maxBuffer: 16 * 1024 * 1024, env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" } });
  return stdout;
}

function lastLine(text: string): string {
  return text.trim().split("\n").filter((line) => line.trim() !== "").pop() ?? "";
}

function failureText(error: unknown): string {
  const stderr = typeof error === "object" && error !== null && "stderr" in error ? String((error as { stderr: unknown }).stderr) : "";
  return stderr !== "" ? stderr : error instanceof Error ? error.message : String(error);
}

export async function deleteMacWorktree(request: DeleteRequest, projects = projectsDir()): Promise<DeleteResult> {
  const info = await stat(request.path).catch(() => null);
  if (info === null || !info.isDirectory()) return fail("That worktree no longer exists.");

  let real: string;
  let common: string;
  try {
    real = await realpath(request.path);
    const raw = (await git(real, ["rev-parse", "--git-common-dir"])).trim();
    common = await realpath(isAbsolute(raw) ? raw : resolve(real, raw));
  } catch {
    return fail("That folder isn't a git worktree.");
  }

  const entries = parseWorktreeList(await gitDir(common, ["worktree", "list", "--porcelain"]).catch(() => ""));
  const resolved = await Promise.all(entries.map((entry) => realpath(entry.path).catch(() => entry.path)));
  const index = resolved.indexOf(real);
  if (index === -1) return fail("That folder isn't a registered worktree.");
  if (index === 0 && entries[0]?.bare !== true) return fail("This is the project's main checkout. It can't be deleted from here.");

  try {
    await gitDir(common, ["worktree", "remove", ...(request.force ? ["--force"] : []), real]);
  } catch (error) {
    const text = failureText(error);
    if (NEEDS_FORCE.test(text)) return fail("It has uncommitted changes.", true);
    return fail(lastLine(text) || "Git couldn't remove the worktree.");
  }

  const notes: string[] = [];
  if (request.deleteBranch && request.branch !== null) {
    try {
      await gitDir(common, ["branch", "-d", request.branch]);
      notes.push(`Deleted the branch ${request.branch}.`);
    } catch {
      notes.push(`Kept the branch ${request.branch}; it isn't fully merged.`);
    }
  }
  if (request.deleteSessions) {
    const dir = join(projects, encodeProjectPath(real));
    if (dir.startsWith(projects + sep) && dir !== projects) {
      await rm(dir, { recursive: true, force: true });
      notes.push("Deleted its Claude sessions.");
    }
  }
  return { ok: true, needsForce: false, error: null, notes };
}

export function deleteScript(request: Pick<DeleteRequest, "path" | "branch" | "force" | "deleteBranch" | "deleteSessions">): string {
  const branch = request.deleteBranch && request.branch !== null ? shq(request.branch) : "''";
  return `
wt=${shq(request.path)}
branch=${branch}
[ -d "$wt" ] || { echo "ERR That worktree no longer exists."; exit 10; }
common=$(git -C "$wt" rev-parse --git-common-dir 2>/dev/null) || { echo "ERR That folder isn't a git worktree."; exit 11; }
case "$common" in /*) ;; *) common="$wt/$common";; esac
common=$(cd "$common" && pwd -P)
real=$(cd "$wt" && pwd -P)
list=$(git --git-dir="$common" worktree list --porcelain 2>/dev/null)
printf '%s\\n' "$list" | grep -Fxq "worktree $real" || { echo "ERR That folder isn't a registered worktree."; exit 12; }
first=$(printf '%s\\n' "$list" | sed -n '1s/^worktree //p')
firstblock=$(printf '%s\\n' "$list" | awk 'BEGIN{RS=""} NR==1')
if [ "$first" = "$real" ] && ! printf '%s\\n' "$firstblock" | grep -qx bare; then echo "ERR This is the project's main checkout. It can't be deleted from here."; exit 13; fi
if err=$(git --git-dir="$common" worktree remove ${request.force ? "--force " : ""}"$real" 2>&1); then :; else
  if printf '%s' "$err" | grep -qiE 'modified or untracked|--force'; then echo NEEDSFORCE; exit 20; fi
  echo "ERR $(printf '%s' "$err" | tail -n 1)"; exit 21
fi
if [ -n "$branch" ]; then
  if git --git-dir="$common" branch -d "$branch" >/dev/null 2>&1; then echo "NOTE Deleted the branch $branch."; else echo "NOTE Kept the branch $branch; it isn't fully merged."; fi
fi
${request.deleteSessions ? `enc=$(printf '%s' "$real" | sed 's/[^a-zA-Z0-9]/-/g')
case "$enc" in -?*) rm -rf "$HOME/.claude/projects/$enc"; echo "NOTE Deleted its Claude sessions.";; esac` : ""}
echo OK
`;
}

export function parseDeleteOutput(stdout: string, code: number | null): DeleteResult {
  const lines = stdout.split("\n").map((line) => line.trim());
  const notes = lines.filter((line) => line.startsWith("NOTE ")).map((line) => line.slice(5));
  if (lines.includes("NEEDSFORCE")) return { ok: false, needsForce: true, error: "It has uncommitted changes.", notes };
  const error = lines.find((line) => line.startsWith("ERR "));
  if (error) return { ok: false, needsForce: false, error: error.slice(4), notes };
  if (code === 0 && lines.includes("OK")) return { ok: true, needsForce: false, error: null, notes };
  return { ok: false, needsForce: false, error: "The VM didn't finish the delete.", notes };
}

export async function deleteVmWorktree(request: DeleteRequest, runScript?: (script: string) => Promise<{ code: number | null; stdout: string; stderr: string; approvalUrl?: string | null }>): Promise<DeleteResult> {
  if (!runScript && request.target === null) return fail("No VM is configured.");
  const target = request.target as VmTarget;
  const result = await (runScript ?? ((script) => runSsh(target, script, { timeout: 5 * 60 * 1000 })))(deleteScript(request));
  if (result.stdout.trim() === "" && result.code !== 0) return fail(describeSshFailure(result));
  return parseDeleteOutput(result.stdout, result.code);
}

export async function deleteWorktree(request: DeleteRequest): Promise<DeleteResult> {
  return request.location === "mac" ? deleteMacWorktree(request) : deleteVmWorktree(request);
}

export function parsePruneOutput(text: string): string[] {
  return text
    .split("\n")
    .map((line) => /^Removing (?:worktrees\/)?([^:]+):/.exec(line.trim())?.[1])
    .filter((name): name is string => name !== undefined && name !== "");
}

export async function pruneMac(repos: readonly string[], dryRun: boolean): Promise<PruneEntry[]> {
  const entries: PruneEntry[] = [];
  for (const repoPath of repos) {
    const repo = expandHome(repoPath);
    try {
      const { stdout, stderr } = await run("git", ["-C", repo, "worktree", "prune", "-v", ...(dryRun ? ["--dry-run"] : [])], { timeout: 60000, env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" } });
      const output = `${stdout}\n${stderr}`;
      entries.push({ location: "mac", repo: basename(repo), items: parsePruneOutput(output) });
    } catch {
      continue;
    }
  }
  return entries;
}

export function pruneScript(repos: readonly string[], dryRun: boolean): string {
  const list = repos.map(shq).join(" ");
  return `
H="$HOME"
for r in ${list} "$H"/Developer/.vmc/*.git; do
  case "$r" in "~/"*) r="$H/\${r#\\~/}";; esac
  [ -e "$r/.git" ] || [ -d "$r/objects" ] || continue
  echo "@@REPO $r"
  git -C "$r" worktree prune -v ${dryRun ? "--dry-run " : ""}2>&1
  echo "@@END"
done
`;
}

export function parsePruneScript(stdout: string): PruneEntry[] {
  const entries: PruneEntry[] = [];
  let current: { repo: string; lines: string[] } | null = null;
  for (const line of stdout.split("\n")) {
    if (line.startsWith("@@REPO ")) current = { repo: basename(line.slice(7)).replace(/\.git$/, ""), lines: [] };
    else if (line === "@@END" && current) {
      entries.push({ location: "vm", repo: current.repo, items: parsePruneOutput(current.lines.join("\n")) });
      current = null;
    } else if (current) current.lines.push(line);
  }
  return entries;
}

export async function pruneVm(target: VmTarget, repos: readonly string[], dryRun: boolean): Promise<{ entries: PruneEntry[]; error: string | null }> {
  const result = await runSsh(target, pruneScript(repos, dryRun), { timeout: 60000 });
  if (result.code !== 0) return { entries: [], error: describeSshFailure(result) };
  return { entries: parsePruneScript(result.stdout), error: null };
}

export async function prune(input: { repos: readonly string[]; vm: { target: VmTarget; repos: readonly string[] } | null }, dryRun: boolean): Promise<PruneResult> {
  const mac = await pruneMac(input.repos, dryRun);
  if (!input.vm) return { entries: mac, error: null };
  const vm = await pruneVm(input.vm.target, input.vm.repos, dryRun);
  return { entries: [...mac, ...vm.entries], error: vm.error };
}
