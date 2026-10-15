import { describe, expect, it } from "vitest";
import type { Worktree } from "@/data/types";
import { buildDeleteRequest } from "./delete";

const tree: Worktree = {
  id: "mac:/Users/me/wt/feature",
  name: "feature",
  repo: "adt-studio",
  branch: "me/feature",
  head: "abc",
  location: "mac",
  path: "/Users/me/wt/feature",
  modified: 0,
  ahead: 0,
  behind: 0,
  lastActive: 1,
  sessions: [],
  hasEnv: false,
  isMain: false,
  merged: false,
  upstreamGone: false,
};
const target = { host: "adt-dev.ts.net", user: "dev" };
const options = { force: false, deleteBranch: false, deleteSessions: false };

describe("buildDeleteRequest", () => {
  it("builds a Mac request without a VM target", () => {
    expect(buildDeleteRequest(tree, target, options)).toMatchObject({ location: "mac", target: null, path: tree.path, force: false });
  });

  it("includes the VM target for VM worktrees", () => {
    expect(buildDeleteRequest({ ...tree, location: "vm" }, target, options)?.target).toEqual(target);
  });

  it("allows a detached worktree (no branch)", () => {
    expect(buildDeleteRequest({ ...tree, branch: null }, target, { ...options, deleteBranch: true })?.branch).toBeNull();
  });

  it("refuses a branch name with unsafe characters", () => {
    expect(buildDeleteRequest({ ...tree, branch: "bad;name" }, target, options)).toBeNull();
  });

  it("refuses a relative path", () => {
    expect(buildDeleteRequest({ ...tree, path: "relative/path" }, target, options)).toBeNull();
  });
});
