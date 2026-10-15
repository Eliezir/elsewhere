import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({ shell: {} }));

const { openMacTerminal, remoteScript, terminalScript, windowsTerminalScript } = await import("./terminal");

const target = { host: "adt-dev.ts.net", user: "dev" };

describe("remoteScript", () => {
  it("opens a login shell in the worktree folder", () => {
    expect(remoteScript({ mode: "shell", path: "/home/dev/Developer/worktrees/a/b" })).toBe(`cd '/home/dev/Developer/worktrees/a/b' && exec "\${SHELL:-bash}" -l`);
  });

  it("opens a plain login shell in the home folder when there is no path", () => {
    expect(remoteScript({ mode: "shell", path: null })).toBe(`exec "\${SHELL:-bash}" -l`);
  });

  it("continues the last Claude conversation, starts a new one if there isn't any, then keeps the shell", () => {
    expect(remoteScript({ mode: "claude", path: "/p" })).toBe(`cd '/p' && { claude --continue || claude; }; exec "\${SHELL:-bash}" -l`);
  });

  it("quotes hostile folder names", () => {
    expect(remoteScript({ mode: "shell", path: "/tmp/a'; rm -rf / #" })).toContain("'/tmp/a'\\''; rm -rf / #'");
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
