import { describe, expect, it } from "vitest";
import { openInRemoteT3, parseRemotePayload, pickRemoteThread, type RemoteT3Deps } from "./t3Remote";

const payload = {
  environmentId: "env-1",
  rows: [
    { thread_id: "old", title: "Older", updated_at: "2026-11-01T10:00:00Z", cwd: "/home/u/repo" },
    { thread_id: "new", title: "Newest", updated_at: "2026-11-05T10:00:00Z", cwd: "/home/u/repo" },
    { thread_id: "other", title: "Elsewhere", updated_at: "2026-11-06T10:00:00Z", cwd: "/home/u/other" },
  ],
};

describe("remote T3 threads", () => {
  it("parses the last JSON line and drops malformed rows", () => {
    const parsed = parseRemotePayload(`noise\n${JSON.stringify({ environmentId: "e", rows: [{ thread_id: "a", title: null, cwd: "/x" }, { nope: 1 }] })}\n`);
    expect(parsed?.environmentId).toBe("e");
    expect(parsed?.rows).toEqual([{ thread_id: "a", title: null, updated_at: null, cwd: "/x" }]);
    expect(parseRemotePayload("not json")).toBeNull();
  });

  it("picks the newest thread for the exact folder and builds the link", () => {
    expect(pickRemoteThread(payload, "/home/u/repo")).toEqual({ url: "t3code://threads/env-1/new", title: "Newest" });
    expect(pickRemoteThread(payload, "/home/u/missing")).toBeNull();
    expect(pickRemoteThread({ ...payload, environmentId: "" }, "/home/u/repo")).toBeNull();
  });
});

function deps(over: Partial<RemoteT3Deps> = {}): RemoteT3Deps & { opened: string[]; copied: string[] } {
  const opened: string[] = [];
  const copied: string[] = [];
  return {
    opened,
    copied,
    readRemote: async () => ({ payload, error: null }),
    findT3: async () => "/Applications/T3 Code.app",
    openUrl: async (url) => void opened.push(url),
    openApp: async () => "",
    copy: (text) => void copied.push(text),
    ...over,
  };
}

const input = { target: { host: "pc", user: "u" }, path: "/home/u/repo" };

describe("openInRemoteT3", () => {
  it("opens the thread when one exists", async () => {
    const d = deps();
    const result = await openInRemoteT3(input, d);
    expect(result).toMatchObject({ ok: true, opened: "thread", title: "Newest", copied: null });
    expect(d.opened).toEqual(["t3code://threads/env-1/new"]);
  });

  it("copies the branch name and opens the app when there is no thread yet", async () => {
    const d = deps();
    const result = await openInRemoteT3({ ...input, path: "/home/u/new-folder", branch: "feature/x" }, d);
    expect(result).toMatchObject({ ok: true, opened: "app", copied: "branch" });
    expect(d.copied).toEqual(["feature/x"]);
  });

  it("falls back to the path when the worktree has no branch", async () => {
    const d = deps();
    const result = await openInRemoteT3({ ...input, path: "/home/u/new-folder", branch: null }, d);
    expect(result).toMatchObject({ opened: "app", copied: "path" });
    expect(d.copied).toEqual(["/home/u/new-folder"]);
  });

  it("reports an unreachable machine and a missing app", async () => {
    expect((await openInRemoteT3(input, deps({ readRemote: async () => ({ payload: null, error: "unreachable" }) }))).error).toBe("unreachable");
    expect((await openInRemoteT3(input, deps({ findT3: async () => null }))).ok).toBe(false);
  });
});
