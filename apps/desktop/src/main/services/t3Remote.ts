import type { RemoteT3Input, RemoteT3Result } from "@vmc/shared";
import { runSsh, shq } from "./ssh";
import { findApp } from "./tools";

export interface RemoteThreadRow {
  thread_id: string;
  title: string | null;
  updated_at: string | null;
  cwd: string | null;
}

export interface RemoteT3Payload {
  environmentId: string;
  rows: RemoteThreadRow[];
}

export const REMOTE_T3_SCRIPT = `
const { DatabaseSync } = require("node:sqlite");
const fs = require("node:fs");
const base = process.env.HOME + "/.t3/userdata";
let environmentId = "";
try { environmentId = fs.readFileSync(base + "/environment-id", "utf8").trim(); } catch {}
let rows = [];
try {
  const db = new DatabaseSync(base + "/statev2.sqlite", { readOnly: true });
  rows = db.prepare("select t.thread_id, t.title, t.updated_at, coalesce(t.worktree_path, p.workspace_root) as cwd from projection_threads t join projection_projects p on p.project_id = t.project_id where t.deleted_at is null and t.archived_at is null").all();
} catch {}
console.log(JSON.stringify({ environmentId, rows }));
`;

export function parseRemotePayload(stdout: string): RemoteT3Payload | null {
  const line = stdout.trim().split("\n").filter((entry) => entry.startsWith("{")).pop();
  if (line === undefined) return null;
  try {
    const parsed: unknown = JSON.parse(line);
    if (typeof parsed !== "object" || parsed === null) return null;
    const { environmentId, rows } = parsed as { environmentId?: unknown; rows?: unknown };
    if (typeof environmentId !== "string" || !Array.isArray(rows)) return null;
    const clean: RemoteThreadRow[] = [];
    for (const row of rows) {
      if (typeof row !== "object" || row === null) continue;
      const entry = row as Record<string, unknown>;
      if (typeof entry.thread_id !== "string") continue;
      clean.push({
        thread_id: entry.thread_id,
        title: typeof entry.title === "string" ? entry.title : null,
        updated_at: typeof entry.updated_at === "string" ? entry.updated_at : null,
        cwd: typeof entry.cwd === "string" ? entry.cwd : null,
      });
    }
    return { environmentId, rows: clean };
  } catch {
    return null;
  }
}

export function pickRemoteThread(payload: RemoteT3Payload, path: string): { url: string; title: string } | null {
  if (payload.environmentId === "") return null;
  const matches = payload.rows.filter((row) => row.cwd === path).sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""));
  const newest = matches[0];
  if (!newest) return null;
  return { url: `t3code://threads/${encodeURIComponent(payload.environmentId)}/${encodeURIComponent(newest.thread_id)}`, title: newest.title ?? "Untitled thread" };
}

export interface RemoteT3Deps {
  readRemote: (target: RemoteT3Input["target"]) => Promise<{ payload: RemoteT3Payload | null; error: string | null }>;
  findT3: () => Promise<string | null>;
  openUrl: (url: string) => Promise<void>;
  openApp: (path: string) => Promise<string>;
  copy: (text: string) => void;
}

const realDeps: RemoteT3Deps = {
  readRemote: async (target) => {
    const result = await runSsh(target, `node --no-warnings -e ${shq(REMOTE_T3_SCRIPT)}`, { timeout: 30000 });
    if (result.code !== 0) return { payload: null, error: "Couldn't read T3 on the remote machine. Is it reachable?" };
    return { payload: parseRemotePayload(result.stdout), error: null };
  },
  findT3: () => findApp("t3code"),
  openUrl: async (url) => {
    const { shell } = await import("electron");
    await shell.openExternal(url);
  },
  openApp: async (path) => {
    const { shell } = await import("electron");
    return shell.openPath(path);
  },
  copy: (text) => {
    void import("electron").then(({ clipboard }) => clipboard.writeText(text));
  },
};

export async function openInRemoteT3(input: RemoteT3Input, deps: RemoteT3Deps = realDeps): Promise<RemoteT3Result> {
  const appPath = await deps.findT3();
  if (appPath === null) return { ok: false, opened: null, title: null, copied: null, error: "T3 Code isn't installed on this Mac." };
  const { payload, error } = await deps.readRemote(input.target);
  if (error !== null) return { ok: false, opened: null, title: null, copied: null, error };
  const thread = payload ? pickRemoteThread(payload, input.path) : null;
  if (thread) {
    await deps.openUrl(thread.url);
    return { ok: true, opened: "thread", title: thread.title, copied: null, error: null };
  }
  const copied = input.branch ? "branch" : "path";
  deps.copy(input.branch ?? input.path);
  const failure = await deps.openApp(appPath);
  return failure === "" ? { ok: true, opened: "app", title: null, copied, error: null } : { ok: false, opened: null, title: null, copied, error: failure };
}
