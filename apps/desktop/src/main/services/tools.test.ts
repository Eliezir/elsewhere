import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({ app: {}, shell: {} }));

const { openInTool, parseT3Rows, pickThreads } = await import("./tools");

const rows = [
  { thread_id: "old", worktree_path: "/w/a", title: "Old", updated_at: "2026-01-01T00:00:00Z" },
  { thread_id: "new", worktree_path: "/w/a", title: "New", updated_at: "2026-02-01T00:00:00Z" },
  { thread_id: "other", worktree_path: "/w/b", title: null, updated_at: null },
];

describe("pickThreads", () => {
  it("links the newest thread for each requested path", () => {
    const threads = pickThreads(rows, "env-1", ["/w/a"]);
    expect(Object.keys(threads)).toEqual(["/w/a"]);
    expect(threads["/w/a"]).toEqual({ url: "t3code://threads/env-1/new", title: "New" });
  });

  it("names untitled threads and encodes ids", () => {
    const threads = pickThreads(rows, "env 1", ["/w/b"]);
    expect(threads["/w/b"]).toEqual({ url: "t3code://threads/env%201/other", title: "Untitled thread" });
  });
});

describe("parseT3Rows", () => {
  it("keeps valid rows and ignores junk", () => {
    expect(parseT3Rows(JSON.stringify([{ thread_id: "t", worktree_path: "/p", title: "x", updated_at: "u" }, { thread_id: 5 }, "nope"]))).toEqual([
      { thread_id: "t", worktree_path: "/p", title: "x", updated_at: "u" },
    ]);
    expect(parseT3Rows("not json")).toEqual([]);
    expect(parseT3Rows("{}")).toEqual([]);
  });
});

function deps(overrides: Partial<Parameters<typeof openInTool>[2]> = {}) {
  const calls: string[] = [];
  return {
    calls,
    deps: {
      findApp: async () => "/Applications/Tool.app",
      threads: async () => ({}),
      openUrl: async (url: string) => void calls.push(`url:${url}`),
      openApp: async (path: string) => (calls.push(`app:${path}`), ""),
      exists: async () => true,
      ...overrides,
    },
  };
}

describe("openInTool", () => {
  it("opens the exact T3 thread when the worktree has one", async () => {
    const { deps: d, calls } = deps({ threads: async (path: string) => ({ [path]: { url: "t3code://threads/e/t", title: "x" } }) });
    expect(await openInTool("t3code", "/w/a", d)).toEqual({ ok: true, opened: "thread", error: null });
    expect(calls).toEqual(["url:t3code://threads/e/t"]);
  });

  it("falls back to opening the app when there is no thread", async () => {
    const { deps: d, calls } = deps();
    expect(await openInTool("t3code", "/w/a", d)).toEqual({ ok: true, opened: "app", error: null });
    expect(calls).toEqual(["app:/Applications/Tool.app"]);
  });

  it("only brings Conductor to the front, since it can't open an existing workspace", async () => {
    const { deps: d, calls } = deps({ threads: async () => ({ "/w/a": { url: "t3code://x", title: "x" } }) });
    expect((await openInTool("conductor", "/w/a", d)).opened).toBe("app");
    expect(calls).toEqual(["app:/Applications/Tool.app"]);
  });

  it("reports a missing app or folder", async () => {
    expect((await openInTool("conductor", "/w/a", deps({ findApp: async () => null }).deps)).error).toContain("isn't installed");
    expect((await openInTool("conductor", "/w/a", deps({ exists: async () => false }).deps)).error).toContain("no longer exists");
  });
});
