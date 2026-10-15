import { execFile } from "node:child_process";
import { cp, lstat, mkdir, mkdtemp, readdir, rm, stat, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { MoveProgress, MoveRequest, MoveResult } from "@vmc/shared";
import { deleteMacWorktree, deleteVmWorktree } from "../cleanup";
import { encodeProjectPath, projectsDir } from "../sessions";
import { shq } from "../ssh";
import { copyRewritten, listFiles, mergeNewer, vmPathsFor } from "./paths";
import type { Remote } from "./remote";

const exec = promisify(execFile);

export type Emit = (progress: MoveProgress) => void;

class StepError extends Error {}

export async function localGit(cwd: string, args: readonly string[], env: Record<string, string> = {}): Promise<string> {
  try {
    const { stdout } = await exec("git", ["-C", cwd, ...args], {
      timeout: 10 * 60 * 1000,
      maxBuffer: 32 * 1024 * 1024,
      env: { ...process.env, GIT_OPTIONAL_LOCKS: "0", ...env },
    });
    return stdout.trim();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new StepError(message.split("\n").filter((line) => line.trim() !== "").slice(-3).join(" "));
  }
}

async function remoteOk(remote: Remote, script: string, failure: string): Promise<string> {
  const result = await remote.run(`set -e\n${script}`);
  if (result.code !== 0) {
    const detail = result.stderr.trim().split("\n").slice(-2).join(" ");
    throw new StepError(detail === "" ? failure : `${failure} (${detail})`);
  }
  return result.stdout.trim();
}

async function step<T>(emit: Emit, id: string, work: () => Promise<T>, detail?: (value: T) => string | null): Promise<T> {
  emit({ step: id, status: "running", detail: null });
  try {
    const value = await work();
    emit({ step: id, status: "done", detail: detail ? detail(value) : null });
    return value;
  } catch (error) {
    emit({ step: id, status: "failed", detail: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}

async function exists(path: string): Promise<boolean> {
  return stat(path).then(
    () => true,
    () => false,
  );
}

async function removeOriginal(request: MoveRequest, remote: Remote, emit: Emit, projects: string, side: "mac" | "vm"): Promise<string> {
  const label = side === "mac" ? "Mac" : "VM";
  emit({ step: "remove", status: "running", detail: null });
  const base = { target: side === "vm" ? request.target : null, branch: request.branch, repo: request.repo, force: false, deleteBranch: false, deleteSessions: false };
  const result =
    side === "mac"
      ? await deleteMacWorktree({ ...base, location: "mac", path: request.macPath }, projects)
      : await deleteVmWorktree({ ...base, location: "vm", path: request.vmPath ?? "/" }, (script) => remote.run(script));
  if (result.ok) {
    emit({ step: "remove", status: "done", detail: null });
    return `The ${label} copy was removed.`;
  }
  const reason = result.needsForce ? "it has changes that weren't copied" : (result.error ?? "it couldn't be removed");
  emit({ step: "remove", status: "failed", detail: reason });
  return `The ${label} copy was kept: ${reason}.`;
}

async function moveToVm(request: MoveRequest, remote: Remote, emit: Emit, projects: string): Promise<MoveResult> {
  const home = await step(emit, "preflight", async () => {
    const value = await remote.home();
    if (value === "") throw new StepError("Can't reach the VM. Is Tailscale connected?");
    await remoteOk(remote, "git --version >/dev/null", "Git isn't installed on the VM");
    return value;
  });
  const paths = vmPathsFor(home, request.repo, request.name);

  const status = await localGit(request.macPath, ["status", "--porcelain"]);
  if (status !== "") {
    await step(emit, "commit", async () => {
      await localGit(request.macPath, ["add", "-A"]);
      await localGit(request.macPath, ["commit", "-q", "--no-verify", "-m", "WIP: moved to the VM"]);
    });
  }
  const head = await localGit(request.macPath, ["rev-parse", "HEAD"]);

  await step(emit, "hub", () => remoteOk(remote, `mkdir -p ${shq(`${home}/Developer/.vmc`)}\n[ -d ${shq(`${paths.hub}/objects`)} ] || git init --bare -q ${shq(paths.hub)}`, "Couldn't prepare the VM repository"));

  const incoming = `refs/vmc/incoming/${request.branch}`;
  await step(emit, "push", () => localGit(request.macPath, ["push", "-q", remote.url(paths.hub), `${request.branch}:${incoming}`], remote.gitEnv).then(() => undefined));

  await step(emit, "checkout", () =>
    remoteOk(
      remote,
      [
        `mkdir -p ${shq(`${home}/Developer/worktrees/${request.repo}`)}`,
        `if [ -e ${shq(`${paths.worktree}/.git`)} ]; then`,
        `  cur=$(git -C ${shq(paths.worktree)} rev-parse HEAD)`,
        `  inc=$(git -C ${shq(paths.hub)} rev-parse ${shq(incoming)})`,
        '  if [ "$cur" != "$inc" ]; then',
        `    if git -C ${shq(paths.worktree)} merge-base --is-ancestor "$cur" "$inc"; then`,
        `      git -C ${shq(paths.worktree)} merge -q --ff-only ${shq(incoming)}`,
        "    else",
        '      echo "The VM copy has changes the Mac doesn\'t. Move it back first." >&2',
        "      exit 1",
        "    fi",
        "  fi",
        "else",
        `  git -C ${shq(paths.hub)} worktree add -q -B ${shq(request.branch)} ${shq(paths.worktree)} ${shq(incoming)}`,
        "fi",
        `git -C ${shq(paths.worktree)} rev-parse HEAD`,
      ].join("\n"),
      "Couldn't create the worktree on the VM",
    ).then((vmHead) => {
      if (vmHead !== head) throw new StepError("The VM worktree is at a different commit than the Mac.");
    }),
  );

  const sessionsDir = join(projects, encodeProjectPath(request.macPath));
  let copied = 0;
  if (await exists(sessionsDir)) {
    copied = await step(emit, "sessions", async () => {
      const staging = await mkdtemp(join(tmpdir(), "vmc-sessions-"));
      try {
        const vmEncoded = encodeProjectPath(paths.worktree);
        const count = await copyRewritten(sessionsDir, join(staging, vmEncoded), request.macPath, paths.worktree);
        const files = (await listFiles(join(staging, vmEncoded))).map((file) => `${vmEncoded}/${file}`);
        const result = await remote.upload(staging, files, `${home}/.claude/projects`);
        if (result.code !== 0) throw new StepError(`Couldn't copy the sessions (${result.stderr.trim().split("\n").pop() ?? "tar failed"})`);
        return count;
      } finally {
        await rm(staging, { recursive: true, force: true });
      }
    }, (count) => `${count} files`);
  }

  if (request.includeEnv) {
    const candidates = (await readdir(request.macPath)).filter((name) => name === ".env" || name.startsWith(".env."));
    const names: string[] = [];
    for (const name of candidates) if ((await lstat(join(request.macPath, name))).isFile()) names.push(name);
    if (names.length > 0) {
      await step(emit, "env", async () => {
        const staging = await mkdtemp(join(tmpdir(), "vmc-env-"));
        try {
          for (const name of names) await cp(join(request.macPath, name), join(staging, name));
          const result = await remote.upload(staging, names, paths.worktree);
          if (result.code !== 0) throw new StepError(`Couldn't copy the .env files (${result.stderr.trim().split("\n").pop() ?? "tar failed"})`);
        } finally {
          await rm(staging, { recursive: true, force: true });
        }
      }, () => `${names.length} ${names.length === 1 ? "file" : "files"}`);
    }
  }

  const notes = [copied > 0 ? `${copied} session files copied.` : null];
  if (request.removeSource) notes.push(await removeOriginal(request, remote, emit, projects, "mac"));
  return { ok: true, error: null, note: notes.filter((entry): entry is string => entry !== null).join(" ") || null, vmPath: paths.worktree };
}

async function moveToMac(request: MoveRequest, remote: Remote, emit: Emit, projects: string): Promise<MoveResult> {
  const vmPath = request.vmPath;
  if (vmPath === null) return { ok: false, error: "This worktree has no VM path.", note: null, vmPath: null };

  const home = await step(emit, "preflight", async () => {
    const value = await remote.home();
    if (value === "") throw new StepError("Can't reach the VM. Is Tailscale connected?");
    return value;
  });

  const [name, email] = await Promise.all([localGit(request.macPath, ["config", "user.name"]).catch(() => "Elsewhere"), localGit(request.macPath, ["config", "user.email"]).catch(() => "elsewhere@localhost")]);
  await step(emit, "commit", () =>
    remoteOk(
      remote,
      `cd ${shq(vmPath)}\nif [ -n "$(git status --porcelain)" ]; then git add -A && git -c user.name=${shq(name)} -c user.email=${shq(email)} commit -q --no-verify -m "WIP: moved to the Mac"; fi`,
      "Couldn't commit the VM changes",
    ),
  );

  const fromVm = `refs/vmc/from-vm/${request.branch}`;
  await step(emit, "fetch", () => localGit(request.macPath, ["fetch", "-q", remote.url(vmPath), `+${request.branch}:${fromVm}`], remote.gitEnv).then(() => undefined));

  let note: string | null = null;
  await step(emit, "merge", async () => {
    if ((await localGit(request.macPath, ["status", "--porcelain"])) !== "") throw new StepError("The Mac worktree has uncommitted changes. Commit or stash them first.");
    const head = await localGit(request.macPath, ["rev-parse", "HEAD"]);
    const incoming = await localGit(request.macPath, ["rev-parse", fromVm]);
    if (head === incoming) {
      note = "The Mac already has these commits.";
      return;
    }
    const ancestor = await localGit(request.macPath, ["merge-base", "--is-ancestor", "HEAD", fromVm]).then(
      () => true,
      () => false,
    );
    if (!ancestor) throw new StepError(`The Mac and VM both have new commits. Merge ${fromVm} yourself.`);
    await localGit(request.macPath, ["merge", "-q", "--ff-only", fromVm]);
  });

  const staging = await mkdtemp(join(tmpdir(), "vmc-back-"));
  let merged = { copied: 0, kept: 0 };
  try {
    const vmEncoded = encodeProjectPath(vmPath);
    const download = await remote.download(`${home}/.claude/projects`, vmEncoded, staging);
    if (download.code === 0 && (await exists(join(staging, vmEncoded)))) {
      await step(emit, "sessions", async () => {
        const rewritten = join(staging, "rewritten");
        await copyRewritten(join(staging, vmEncoded), rewritten, vmPath, request.macPath);
        merged = await mergeNewer(rewritten, join(projects, encodeProjectPath(request.macPath)));
        return merged;
      }, (value) => `${value.copied} copied, ${value.kept} kept`);
    }
  } finally {
    await rm(staging, { recursive: true, force: true });
  }

  const notes = [note ?? (merged.copied > 0 ? `${merged.copied} session files copied back.` : null)];
  if (request.removeSource) notes.push(await removeOriginal(request, remote, emit, projects, "vm"));
  return { ok: true, error: null, note: notes.filter((entry): entry is string => entry !== null).join(" ") || null, vmPath };
}

export async function runMove(request: MoveRequest, remote: Remote, emit: Emit, projects = projectsDir()): Promise<MoveResult> {
  try {
    await mkdir(projects, { recursive: true });
    return request.direction === "to-vm" ? await moveToVm(request, remote, emit, projects) : await moveToMac(request, remote, emit, projects);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error), note: null, vmPath: null };
  }
}

export async function writeMoveRecord(request: MoveRequest, result: MoveResult, dir: string): Promise<void> {
  if (!result.ok) return;
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "last-move.json"), `${JSON.stringify({ at: Math.floor(Date.now() / 1000), direction: request.direction, branch: request.branch, macPath: request.macPath, vmPath: result.vmPath ?? request.vmPath })}\n`);
}

export function defaultRecordDir(): string {
  return process.env.VMC_HOME ?? join(homedir(), ".vm-companion");
}
