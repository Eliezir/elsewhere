import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { runLocal } from "./ssh";

vi.mock("electron", () => ({ clipboard: {}, shell: {}, app: {}, nativeImage: { createThumbnailFromPath: async () => { throw new Error("none") } } }));

const { getVmT3, openVmInT3, parseT3Remote, t3QueryScript } = await import("./t3Remote");

const target = { host: "vm", user: "dev" };
const PATH_A = "/home/dev/Developer/worktrees/adt-studio/cayenne";

async function fakeHome(withDb = true) {
  const home = await mkdtemp(join(tmpdir(), "vmc-t3-"));
  const dir = join(home, ".t3", "userdata");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "environment-id"), "env-123\n");
  if (withDb) {
    const sql = [
      "CREATE TABLE projection_projects (project_id TEXT, title TEXT, workspace_root TEXT, deleted_at TEXT);",
      "CREATE TABLE projection_threads (thread_id TEXT, project_id TEXT, title TEXT, worktree_path TEXT, updated_at TEXT, deleted_at TEXT, archived_at TEXT);",
      `INSERT INTO projection_projects VALUES ('p1','cayenne','${PATH_A}',NULL);`,
      "INSERT INTO projection_projects VALUES ('p2','other','/home/dev/other',NULL);",
      "INSERT INTO projection_projects VALUES ('p3','gone','/home/dev/gone','2026-01-01');",
      "INSERT INTO projection_threads VALUES ('t-old','p1','Older chat',NULL,'2026-01-01',NULL,NULL);",
      "INSERT INTO projection_threads VALUES ('t-new','p1','Newest chat',NULL,'2026-02-01',NULL,NULL);",
      "INSERT INTO projection_threads VALUES ('t-del','p1','Deleted chat',NULL,'2026-03-01','2026-03-02',NULL);",
      "INSERT INTO projection_threads VALUES ('t-arch','p1','Archived chat',NULL,'2026-03-01',NULL,'2026-03-02');",
    ].join("\n");
    execFileSync("sqlite3", [join(dir, "state.sqlite")], { input: sql });
  }
  return home;
}

async function runScript(home: string, paths: string[]) {
  return runLocal("sh", ["-s"], { input: t3QueryScript(paths), timeout: 30000 }).then((r) => r).catch(() => null).then(async () => {
    const { spawnSync } = await import("node:child_process");
    const out = spawnSync("sh", ["-s"], { input: t3QueryScript(paths), env: { ...process.env, HOME: home }, encoding: "utf8" });
    return { code: out.status, stdout: out.stdout, stderr: out.stderr };
  });
}

describe("the query script against a real database layout", () => {
  it("finds the project for a path and its live threads, newest first", async () => {
    const result = await runScript(await fakeHome(), [PATH_A, "/home/dev/missing"]);
    const parsed = parseT3Remote(result.stdout);
    expect(parsed.environmentId).toBe("env-123");
    expect(parsed.hasDatabase).toBe(true);
    expect(Object.keys(parsed.projects)).toEqual([PATH_A]);
    expect(parsed.projects[PATH_A]).toEqual({
      projectTitle: "cayenne",
      threads: [
        { id: "t-new", title: "Newest chat" },
        { id: "t-old", title: "Older chat" },
      ],
    });
  });

  it("says so when T3 has no database on the VM yet", async () => {
    const parsed = parseT3Remote((await runScript(await fakeHome(false), [PATH_A])).stdout);
    expect(parsed).toEqual({ hasDatabase: false, environmentId: "env-123", projects: {} });
  });

  it("is safe against hostile paths", () => {
    const script = t3QueryScript(["/tmp/a'; rm -rf / #"]);
    expect(script).toContain("'[\"/tmp/a'\\''; rm -rf / #\"]'");
  });
});

describe("parseT3Remote", () => {
  it("tolerates garbage", () => {
    expect(parseT3Remote("@@JSON {not json")).toEqual({ hasDatabase: true, environmentId: null, projects: {} });
    expect(parseT3Remote("@@ERR OperationalError").hasDatabase).toBe(false);
  });
});

describe("getVmT3", () => {
  it("reports an unreachable VM and caches results briefly", async () => {
    let calls = 0;
    const fail = async () => (calls += 1, { code: 255, stdout: "", stderr: "no route" });
    expect((await getVmT3({ host: "a", user: "b" }, ["/x"], fail)).reachable).toBe(false);
    await getVmT3({ host: "a", user: "b" }, ["/x"], fail);
    expect(calls).toBe(1);
  });
});

function deps(overrides: Partial<Parameters<typeof openVmInT3>[2]> = {}) {
  const calls: string[] = [];
  return {
    calls,
    deps: {
      info: async () => ({ reachable: true, hasDatabase: true, environmentId: "env-1", projects: {} }),
      findApp: async () => "/Applications/T3 Code.app",
      copy: (text: string) => void calls.push(`copy:${text}`),
      openUrl: async (url: string) => void calls.push(`url:${url}`),
      openApp: async (path: string) => (calls.push(`app:${path}`), ""),
      ...overrides,
    },
  };
}

describe("openVmInT3", () => {
  it("opens the exact thread on the VM environment when one exists", async () => {
    const { deps: d, calls } = deps({ info: async () => ({ reachable: true, hasDatabase: true, environmentId: "env-1", projects: { [PATH_A]: { projectTitle: "cayenne", threads: [{ id: "t-new", title: "x" }] } } }) });
    expect(await openVmInT3(target, PATH_A, d)).toEqual({ ok: true, opened: "thread", copied: false, projectExists: true, error: null });
    expect(calls).toEqual(["url:t3code://threads/env-1/t-new"]);
  });

  it("opens the app and says the project exists when it has no thread yet", async () => {
    const { deps: d, calls } = deps({ info: async () => ({ reachable: true, hasDatabase: true, environmentId: "env-1", projects: { [PATH_A]: { projectTitle: "cayenne", threads: [] } } }) });
    expect(await openVmInT3(target, PATH_A, d)).toMatchObject({ ok: true, opened: "app", projectExists: true });
    expect(calls).toEqual([`copy:${PATH_A}`, "app:/Applications/T3 Code.app"]);
  });

  it("copies the path and opens the app when the project isn't in T3 yet", async () => {
    const { deps: d, calls } = deps();
    expect(await openVmInT3(target, PATH_A, d)).toEqual({ ok: true, opened: "app", copied: true, projectExists: false, error: null });
    expect(calls[0]).toBe(`copy:${PATH_A}`);
  });

  it("explains when T3 Code isn't installed", async () => {
    expect((await openVmInT3(target, PATH_A, deps({ findApp: async () => null }).deps)).error).toContain("isn't installed");
  });
});
