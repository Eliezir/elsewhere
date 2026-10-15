import { readFile, readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { app } from "electron";
import type { T3Threads, Tool, ToolInfo, ToolsInfo } from "@vmc/shared";
import { runLocal } from "./ssh";

const APP_PREFIX: Record<Tool, string> = { conductor: "Conductor", t3code: "T3 Code" };
const APP_DIRS = ["/Applications", join(homedir(), "Applications")];
const T3_DIR = join(homedir(), ".t3", "userdata");

export interface T3Row {
  thread_id: string;
  worktree_path: string;
  title: string | null;
  updated_at: string | null;
}

export function pickThreads(rows: readonly T3Row[], environmentId: string, wanted: readonly string[]): T3Threads {
  const newest = new Map<string, T3Row>();
  for (const row of rows) {
    if (!wanted.includes(row.worktree_path)) continue;
    const current = newest.get(row.worktree_path);
    if (!current || (row.updated_at ?? "") > (current.updated_at ?? "")) newest.set(row.worktree_path, row);
  }
  const result: T3Threads = {};
  for (const [path, row] of newest) {
    result[path] = { url: `t3code://threads/${encodeURIComponent(environmentId)}/${encodeURIComponent(row.thread_id)}`, title: row.title ?? "Untitled thread" };
  }
  return result;
}

export function parseT3Rows(json: string): T3Row[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const rows: T3Row[] = [];
  for (const item of parsed) {
    if (typeof item !== "object" || item === null) continue;
    const record = item as Record<string, unknown>;
    if (typeof record.thread_id !== "string" || typeof record.worktree_path !== "string") continue;
    rows.push({
      thread_id: record.thread_id,
      worktree_path: record.worktree_path,
      title: typeof record.title === "string" ? record.title : null,
      updated_at: typeof record.updated_at === "string" ? record.updated_at : null,
    });
  }
  return rows;
}

let cache: { at: number; rows: T3Row[]; environmentId: string } | null = null;

async function loadT3(): Promise<{ rows: T3Row[]; environmentId: string } | null> {
  if (cache && Date.now() - cache.at < 20000) return cache;
  const environmentId = (await readFile(join(T3_DIR, "environment-id"), "utf8").catch(() => "")).trim();
  if (environmentId === "") return null;
  const result = await runLocal(
    "sqlite3",
    ["-readonly", "-json", join(T3_DIR, "state.sqlite"), "SELECT thread_id, worktree_path, title, updated_at FROM projection_threads WHERE worktree_path IS NOT NULL AND deleted_at IS NULL AND archived_at IS NULL"],
    { timeout: 15000 },
  );
  if (result.code !== 0) return null;
  cache = { at: Date.now(), rows: parseT3Rows(result.stdout), environmentId };
  return cache;
}

export async function getT3Threads(paths: readonly string[]): Promise<T3Threads> {
  const loaded = await loadT3();
  return loaded ? pickThreads(loaded.rows, loaded.environmentId, paths) : {};
}

export async function findApp(tool: Tool): Promise<string | null> {
  for (const dir of APP_DIRS) {
    const names = await readdir(dir).catch(() => [] as string[]);
    const match = names.filter((name) => name.endsWith(".app") && name.startsWith(APP_PREFIX[tool])).sort()[0];
    if (match) return join(dir, match);
  }
  return null;
}

async function toolInfo(tool: Tool): Promise<ToolInfo> {
  const path = await findApp(tool);
  if (path === null) return { installed: false, name: null, icon: null };
  const icon = await app.getFileIcon(path, { size: "normal" }).then((image) => image.toDataURL(), () => null);
  return { installed: true, name: path.split("/").pop()?.replace(/\.app$/, "") ?? null, icon };
}

export async function getToolsInfo(): Promise<ToolsInfo> {
  const [conductor, t3code] = await Promise.all([toolInfo("conductor"), toolInfo("t3code")]);
  return { conductor, t3code };
}

export interface OpenDeps {
  findApp: (tool: Tool) => Promise<string | null>;
  threads: (path: string) => Promise<T3Threads>;
  openUrl: (url: string) => Promise<void>;
  openApp: (path: string) => Promise<string>;
  exists: (path: string) => Promise<boolean>;
}

const realOpenDeps: OpenDeps = {
  findApp,
  threads: (path) => getT3Threads([path]),
  openUrl: async (url) => {
    const { shell } = await import("electron");
    await shell.openExternal(url);
  },
  openApp: async (path) => {
    const { shell } = await import("electron");
    return shell.openPath(path);
  },
  exists: (path) => stat(path).then(() => true, () => false),
};

export async function openInTool(tool: Tool, path: string, deps: OpenDeps = realOpenDeps): Promise<{ ok: boolean; opened: "thread" | "app" | null; error: string | null }> {
  if (!(await deps.exists(path))) return { ok: false, opened: null, error: "That folder no longer exists." };
  const appPath = await deps.findApp(tool);
  if (appPath === null) return { ok: false, opened: null, error: `${tool === "conductor" ? "Conductor" : "T3 Code"} isn't installed.` };

  if (tool === "t3code") {
    const thread = (await deps.threads(path))[path];
    if (thread) {
      await deps.openUrl(thread.url);
      return { ok: true, opened: "thread", error: null };
    }
  }
  const error = await deps.openApp(appPath);
  return error === "" ? { ok: true, opened: "app", error: null } : { ok: false, opened: null, error };
}

export async function openUrlWithShell(url: string): Promise<void> {
  const { shell } = await import("electron");
  await shell.openExternal(url);
}

export async function openAppPath(path: string): Promise<string> {
  const { shell } = await import("electron");
  return shell.openPath(path);
}
