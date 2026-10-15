import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({ shell: { openExternal: vi.fn() }, clipboard: { writeText: vi.fn() } }));

const { claudeDesktopSshUrl } = await import("./claudeDesktop");

const target = { host: "adt-dev.example.ts.net", user: "dev" };

describe("claudeDesktopSshUrl", () => {
  it("names the connection and the folder", () => {
    expect(claudeDesktopSshUrl(target, "/home/dev/Developer/worktrees/app/lisbon")).toBe(
      "claude://code/new?ssh_host=dev%40adt-dev.example.ts.net&ssh_folder=/home/dev/Developer/worktrees/app/lisbon",
    );
  });

  it("encodes odd characters in the folder", () => {
    expect(claudeDesktopSshUrl(target, "/home/dev/my work")).toContain("ssh_folder=/home/dev/my%20work");
  });

  it("refuses hosts, users and folders Desktop would reject", () => {
    expect(claudeDesktopSshUrl({ host: "-oProxyCommand=x", user: "dev" }, "/a")).toBeNull();
    expect(claudeDesktopSshUrl({ host: "a b", user: "dev" }, "/a")).toBeNull();
    expect(claudeDesktopSshUrl({ host: "h", user: "-x" }, "/a")).toBeNull();
    expect(claudeDesktopSshUrl(target, "relative")).toBeNull();
    expect(claudeDesktopSshUrl(target, "/a/../b")).toBeNull();
  });
});
