import { describe, expect, it } from "vitest";
import { parseListeners, pickKillable } from "./vmPorts";

const OUTPUT = `LISTEN 0 511 127.0.0.1:5173 0.0.0.0:* users:(("node",pid=4321,fd=20))
LISTEN 0 511 [::1]:3001 [::]:* users:(("node",pid=4400,fd=18))
LISTEN 0 128 0.0.0.0:22 0.0.0.0:*
LISTEN 0 4096 127.0.0.53%lo:53 0.0.0.0:*
LISTEN 0 511 127.0.0.1:3773 0.0.0.0:* users:(("node",pid=900,fd=22))
@@CWDS
4321 /home/dev/Developer/worktrees/adt-studio/cayenne/apps/studio
4400 /home/dev/Developer/worktrees/adt-studio/cayenne/apps/api
900 /home/dev
@@BRANCHES
4321 eliezir/beta-update-banner-settings
4400 HEAD
`;

describe("parseListeners", () => {
  it("keeps user listeners with their working directory and skips ssh and system ports", () => {
    expect(parseListeners(OUTPUT)).toEqual([
      { port: 3001, process: "node", pid: 4400, cwd: "/home/dev/Developer/worktrees/adt-studio/cayenne/apps/api", branch: "detached", kind: "project" },
      { port: 3773, process: "node", pid: 900, cwd: "/home/dev", branch: null, kind: "service" },
      { port: 5173, process: "node", pid: 4321, cwd: "/home/dev/Developer/worktrees/adt-studio/cayenne/apps/studio", branch: "eliezir/beta-update-banner-settings", kind: "project" },
    ]);
  });
});

describe("pickKillable", () => {
  const listeners = parseListeners(OUTPUT);
  it("allows project servers", () => {
    expect(pickKillable(listeners, 5173)).toEqual({ pid: 4321 });
  });
  it("refuses services and ports that are gone", () => {
    expect(pickKillable(listeners, 3773)).toHaveProperty("error");
    expect(pickKillable(listeners, 9999)).toHaveProperty("error");
  });
});
