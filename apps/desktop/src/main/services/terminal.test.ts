import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({ shell: {} }));

const { openMacTerminal, remoteScript, terminalScript, tmuxSessionName, windowsTerminalScript } = await import("./terminal");

const target = { host: "adt-dev.ts.net", user: "dev" };

describe("remoteScript", () => {
  it("opens a login shell in the worktree folder", () => {
    expect(remoteScript({ mode: "shell", path: "/home/dev/Developer/worktrees/a/b" })).toBe(`cd '/home/dev/Developer/worktrees/a/b' && exec "\${SHELL:-bash}" -l`);
  });

  it("opens a plain login shell in the home folder when there is no path", () => {
    expect(remoteScript({ mode: "shell", path: null })).toBe(`exec "\${SHELL:-bash}" -l`);
  });

  it("runs Claude inside a named tmux session so it survives a closed laptop and can be reattached", () => {
    const script = remoteScript({ mode: "claude", path: "/home/dev/Developer/worktrees/app/lisbon" });
    expect(script).toContain("cd '/home/dev/Developer/worktrees/app/lisbon' && if command -v tmux");
    expect(script).toContain("tmux new-session -A -s 'cc-lisbon' ");
    expect(script).toContain("claude --continue || claude");
  });

  it("falls back to running Claude directly when tmux is missing", () => {
    expect(remoteScript({ mode: "claude", path: "/p" }).endsWith(`fi; { claude --continue || claude; }; exec "\${SHELL:-bash}" -l`)).toBe(true);
  });

  it("resumes the named conversation in its own tmux session", () => {
    const script = remoteScript({ mode: "claude", path: "/p", sessionId: "7096db01-7391-4fd4-9445-a2ae3f42c53f" });
    expect(script).toContain("-s 'cc-p-7096db01'");
    expect(script).toContain("claude --resume '\\''7096db01-7391-4fd4-9445-a2ae3f42c53f'\\'' || claude --continue || claude");
  });

  it("quotes hostile folder names", () => {
    expect(remoteScript({ mode: "shell", path: "/tmp/a'; rm -rf / #" })).toContain("'/tmp/a'\\''; rm -rf / #'");
  });
});

describe("tmuxSessionName", () => {
  it("builds a safe name from the folder and the session id", () => {
    expect(tmuxSessionName("/a/my folder!", undefined)).toBe("cc-my-folder-");
    expect(tmuxSessionName(null, "abcdef0123456789")).toBe("cc-home-abcdef01");
  });
});

describe("terminalScript", () => {
  it("connects to the VM with a terminal attached", () => {
    const script = terminalScript({ target, path: null, mode: "shell" });
    expect(script.startsWith("#!/bin/sh\nexec ssh -t 'dev@adt-dev.ts.net' ")).toBe(true);
  });
});

describe("windowsTerminalScript", () => {
  it("sends the remote script base64 encoded so no quoting survives cmd", () => {
    const script = windowsTerminalScript({ target, path: "/home/dev/a b", mode: "shell" });
    const encoded = Buffer.from(remoteScript({ mode: "shell", path: "/home/dev/a b" })).toString("base64");
    expect(script).toBe(`@echo off\r\nssh -t dev@adt-dev.ts.net "eval \\"$(echo ${encoded} | base64 -d)\\""\r\n`);
  });
});

describe("openMacTerminal", () => {
  it("refuses anything that isn't an existing folder", async () => {
    expect(await openMacTerminal(42)).toContain("isn't a folder");
    expect(await openMacTerminal("relative/path")).toContain("isn't a folder");
    expect(await openMacTerminal("/definitely/not/here")).toContain("no longer exists");
    expect(await openMacTerminal("/etc/hosts")).toContain("no longer exists");
  });
});
