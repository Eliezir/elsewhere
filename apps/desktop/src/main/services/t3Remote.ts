import { clipboard } from "electron";
import type { VmT3Info, VmT3OpenResult, VmTarget } from "@vmc/shared";
import { runSsh, shq, type SshResult } from "./ssh";
import { openUrlWithShell, findApp, openAppPath } from "./tools";

const TTL_MS = 15000;

const PYTHON = `
import json, os, sqlite3, sys
paths = [p.rstrip("/") for p in json.loads(os.environ["VMC_PATHS"])]
db = os.path.expanduser("~/.t3/userdata/state.sqlite")
try:
    c = sqlite3.connect("file:%s?mode=ro" % db, uri=True)
    projects = c.execute("SELECT project_id, title, workspace_root FROM projection_projects WHERE deleted_at IS NULL").fetchall()
    threads = c.execute("SELECT thread_id, project_id, title, updated_at, worktree_path FROM projection_threads WHERE deleted_at IS NULL AND archived_at IS NULL ORDER BY updated_at DESC").fetchall()
except Exception as error:
    print("@@ERR " + type(error).__name__)
    sys.exit(0)
found = {}
for path in paths:
    for pid, title, root in projects:
        if (root or "").rstrip("/") == path:
            related = [t for t in threads if t[1] == pid or (t[4] or "").rstrip("/") == path]
            found[path] = {"projectTitle": title or "Project", "threads": [{"id": t[0], "title": t[2] or "Untitled thread"} for t in related[:5]]}
            break
print("@@JSON " + json.dumps(found))
`;

export function t3QueryScript(paths: readonly string[]): string {
  return `
ENVF="$HOME/.t3/userdata/environment-id"
DB="$HOME/.t3/userdata/state.sqlite"
[ -f "$ENVF" ] && echo "@@ENV $(tr -d '[:space:]' < "$ENVF")"
[ -f "$DB" ] || { echo "@@NODB"; exit 0; }
VMC_PATHS=${shq(JSON.stringify(paths))} python3 - <<'PY'
${PYTHON}
PY
`;
}

export function parseT3Remote(stdout: string): Omit<VmT3Info, "reachable"> {
  const lines = stdout.split("\n").map((line) => line.trim());
  const environmentId = lines.find((line) => line.startsWith("@@ENV "))?.slice(6) || null;
  const json = lines.find((line) => line.startsWith("@@JSON "));
  const hasDatabase = !lines.includes("@@NODB") && !lines.some((line) => line.startsWith("@@ERR"));
  let projects: VmT3Info["projects"] = {};
  if (json) {
    try {
      projects = JSON.parse(json.slice(7)) as VmT3Info["projects"];
    } catch {
      projects = {};
    }
  }
  return { hasDatabase, environmentId, projects };
}

const cache = new Map<string, { at: number; info: VmT3Info }>();

export async function getVmT3(target: VmTarget, paths: readonly string[], run: (script: string) => Promise<SshResult> = (script) => runSsh(target, script, { timeout: 30000 })): Promise<VmT3Info> {
  const key = `${target.user}@${target.host}:${paths.join("|")}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < TTL_MS) return cached.info;
  const result = await run(t3QueryScript(paths));
  const info: VmT3Info = result.code === 0 ? { reachable: true, ...parseT3Remote(result.stdout) } : { reachable: false, hasDatabase: false, environmentId: null, projects: {} };
  cache.set(key, { at: Date.now(), info });
  return info;
}

export interface OpenVmDeps {
  info: (target: VmTarget, path: string) => Promise<VmT3Info>;
  findApp: () => Promise<string | null>;
  copy: (text: string) => void;
  openUrl: (url: string) => Promise<void>;
  openApp: (path: string) => Promise<string>;
}

const realDeps: OpenVmDeps = {
  info: (target, path) => getVmT3(target, [path]),
  findApp: () => findApp("t3code"),
  copy: (text) => clipboard.writeText(text),
  openUrl: openUrlWithShell,
  openApp: openAppPath,
};

export async function openVmInT3(target: VmTarget, path: string, deps: OpenVmDeps = realDeps): Promise<VmT3OpenResult> {
  const app = await deps.findApp();
  if (app === null) return { ok: false, opened: null, copied: false, projectExists: false, error: "T3 Code isn't installed." };

  const info = await deps.info(target, path);
  const project = info.projects[path.replace(/\/$/, "")];
  const thread = project?.threads[0];
  if (info.environmentId && thread) {
    await deps.openUrl(`t3code://threads/${encodeURIComponent(info.environmentId)}/${encodeURIComponent(thread.id)}`);
    return { ok: true, opened: "thread", copied: false, projectExists: true, error: null };
  }
  deps.copy(path);
  const error = await deps.openApp(app);
  return error === "" ? { ok: true, opened: "app", copied: true, projectExists: project !== undefined, error: null } : { ok: false, opened: null, copied: true, projectExists: project !== undefined, error };
}
