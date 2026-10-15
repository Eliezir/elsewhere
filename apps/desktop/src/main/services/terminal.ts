import { chmod, mkdtemp, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join } from "node:path";
import { shell } from "electron";
import type { TerminalInput } from "@vmc/shared";
import { runLocal, shq } from "./ssh";

export function remoteScript(input: Pick<TerminalInput, "mode" | "path" | "sessionId">): string {
  const enter = input.path ? `cd ${shq(input.path)} && ` : "";
  if (input.mode === "claude" && input.sessionId) return `${enter}{ claude --resume ${shq(input.sessionId)} || claude --continue || claude; }; exec "\${SHELL:-bash}" -l`;
  if (input.mode === "claude") return `${enter}{ claude --continue || claude; }; exec "\${SHELL:-bash}" -l`;
  return `${enter}exec "\${SHELL:-bash}" -l`;
}

export function terminalScript(input: TerminalInput): string {
  return `#!/bin/sh\nexec ssh -t ${shq(`${input.target.user}@${input.target.host}`)} ${shq(remoteScript(input))}\n`;
}

export function windowsTerminalScript(input: TerminalInput): string {
  const encoded = Buffer.from(remoteScript(input)).toString("base64");
  const remote = `eval \\"$(echo ${encoded} | base64 -d)\\"`;
  return `@echo off\r\nssh -t ${input.target.user}@${input.target.host} "${remote}"\r\n`;
}

export async function openVmTerminal(input: TerminalInput): Promise<string | null> {
  const dir = await mkdtemp(join(tmpdir(), "vmc-terminal-"));
  const windows = process.platform === "win32";
  const file = join(dir, `${input.mode === "claude" ? "claude" : "shell"}-on-vm.${windows ? "cmd" : "command"}`);
  await writeFile(file, windows ? windowsTerminalScript(input) : terminalScript(input));
  await chmod(file, 0o700);
  const error = await shell.openPath(file);
  return error === "" ? null : error;
}

export async function openMacTerminal(path: unknown): Promise<string | null> {
  if (typeof path !== "string" || !isAbsolute(path)) return "That isn't a folder path.";
  const info = await stat(path).catch(() => null);
  if (info === null || !info.isDirectory()) return "That folder no longer exists.";
  const result =
    process.platform === "win32"
      ? await runLocal("cmd", ["/c", "start", "cmd", "/k", `cd /d "${path}"`], { timeout: 15000 })
      : await runLocal("open", ["-a", "Terminal", path], { timeout: 15000 });
  return result.code === 0 ? null : (result.stderr.trim().split("\n").pop() ?? "Terminal couldn't be opened.");
}
