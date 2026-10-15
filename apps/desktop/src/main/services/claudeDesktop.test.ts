import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({ shell: { openExternal: vi.fn() }, clipboard: { writeText: vi.fn() } }));

const { claudeDesktopSshUrl, handoffPrompt } = await import("./claudeDesktop");

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

  it("adds a handoff prompt that reads only the end of the copied transcript", () => {
    const url = claudeDesktopSshUrl(target, "/home/dev/Developer/worktrees/app/lisbon", "7096db01-7391-4fd4-9445-a2ae3f42c53f") ?? "";
    const q = decodeURIComponent(url.split("&q=")[1] ?? "");
    expect(q).toContain("/home/dev/.claude/projects/-home-dev-Developer-worktrees-app-lisbon/7096db01-7391-4fd4-9445-a2ae3f42c53f.jsonl");
    expect(q).toContain("tail -n 400");
    expect(q).toBe(handoffPrompt("/home/dev/Developer/worktrees/app/lisbon", "7096db01-7391-4fd4-9445-a2ae3f42c53f"));
    expect(url.length).toBeLessThan(4000);
  });

  it("refuses hosts, users and folders Desktop would reject", () => {
    expect(claudeDesktopSshUrl({ host: "-oProxyCommand=x", user: "dev" }, "/a")).toBeNull();
    expect(claudeDesktopSshUrl({ host: "a b", user: "dev" }, "/a")).toBeNull();
    expect(claudeDesktopSshUrl({ host: "h", user: "-x" }, "/a")).toBeNull();
    expect(claudeDesktopSshUrl(target, "relative")).toBeNull();
    expect(claudeDesktopSshUrl(target, "/a/../b")).toBeNull();
  });
});
