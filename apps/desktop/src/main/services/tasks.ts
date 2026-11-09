import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { TaskKeySchema, type TaskContent, type TaskCreateResult, type TaskEntry, type Worktree } from "@vmc/shared";
import { listMacWorktrees } from "./worktrees";

const known = new Map<string, Worktree>();

export function countTodos(markdown: string): { open: number; done: number } {
  return {
    open: (markdown.match(/^[ \t]*[-*] \[ \]/gm) ?? []).length,
    done: (markdown.match(/^[ \t]*[-*] \[[xX]\]/gm) ?? []).length,
  };
}

export function titleOf(markdown: string, fallback: string): string {
  const heading = /^#\s+(.+)$/m.exec(markdown)?.[1]?.trim();
  return heading && heading !== "" ? heading : fallback;
}

export function taskFile(worktree: string, key: string): string {
  return join(worktree, ".context", key, "TASKS.md");
}

export function templateFor(key: string): string {
  return `# ${key}\n\n## Now\n- [ ] \n\n## Next\n\n## Notes\n`;
}

export function ownerOf(file: string, worktrees: Iterable<string>): { worktree: string; key: string } | null {
  const path = resolve(file);
  for (const worktree of worktrees) {
    const base = `${resolve(worktree)}${sep}.context${sep}`;
    if (!path.startsWith(base)) continue;
    const parts = path.slice(base.length).split(sep);
    const key = parts[0];
    if (parts.length === 2 && parts[1] === "TASKS.md" && key !== undefined && TaskKeySchema.safeParse(key).success) return { worktree, key };
  }
  return null;
}

async function entryFor(tree: Worktree, key: string): Promise<TaskEntry | null> {
  const file = taskFile(tree.path, key);
  try {
    const [info, content] = await Promise.all([stat(file), readFile(file, "utf8")]);
    return { key, title: titleOf(content, key), repo: tree.repo, branch: tree.branch, worktree: tree.path, file, ...countTodos(content), updatedAt: info.mtimeMs };
  } catch {
    return null;
  }
}

async function keysIn(tree: Worktree): Promise<string[]> {
  const entries = await readdir(join(tree.path, ".context"), { withFileTypes: true }).catch(() => []);
  return entries.filter((entry) => entry.isDirectory() && TaskKeySchema.safeParse(entry.name).success).map((entry) => entry.name);
}

export async function scanTasks(repos: readonly string[]): Promise<TaskEntry[]> {
  const trees = await listMacWorktrees(repos);
  known.clear();
  for (const tree of trees) known.set(tree.path, tree);
  const found = await Promise.all(trees.map(async (tree) => Promise.all((await keysIn(tree)).map((key) => entryFor(tree, key)))));
  return found.flat().filter((entry): entry is TaskEntry => entry !== null).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function readTask(file: string): Promise<TaskContent> {
  if (ownerOf(file, known.keys()) === null) return { ok: false, content: "", updatedAt: 0, error: "That file isn't in a known worktree." };
  try {
    const [info, content] = await Promise.all([stat(file), readFile(file, "utf8")]);
    return { ok: true, content, updatedAt: info.mtimeMs, error: null };
  } catch {
    return { ok: false, content: "", updatedAt: 0, error: "Couldn't read the file." };
  }
}

export async function writeTask(file: string, content: string): Promise<TaskContent> {
  if (ownerOf(file, known.keys()) === null) return { ok: false, content: "", updatedAt: 0, error: "That file isn't in a known worktree." };
  try {
    await writeFile(file, content, "utf8");
    return { ok: true, content, updatedAt: (await stat(file)).mtimeMs, error: null };
  } catch {
    return { ok: false, content: "", updatedAt: 0, error: "Couldn't save the file." };
  }
}

export async function createTask(worktree: string, key: string): Promise<TaskCreateResult> {
  const tree = known.get(worktree);
  if (!tree) return { ok: false, entry: null, error: "That worktree isn't known. Refresh the list first." };
  const file = taskFile(tree.path, key);
  const exists = await stat(file).then(() => true, () => false);
  if (!exists) {
    await mkdir(join(tree.path, ".context", key), { recursive: true });
    await writeFile(file, templateFor(key), "utf8");
  }
  return { ok: true, entry: await entryFor(tree, key), error: null };
}
