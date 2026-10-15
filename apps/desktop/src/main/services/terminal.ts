import { chmod, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { shell } from "electron";
import type { TerminalInput } from "@vmc/shared";
import { shq } from "./ssh";

export function terminalScript(input: TerminalInput): string {
  const inner = input.mode === "claude" ? `cd ${shq(input.path)} && exec claude --continue` : `cd ${shq(input.path)} && exec "\${SHELL:-bash}" -l`;
  const remote = `bash -lic ${shq(inner)}`;
  return `#!/bin/sh\nexec ssh -t ${shq(`${input.target.user}@${input.target.host}`)} ${shq(remote)}\n`;
}

export async function openVmTerminal(input: TerminalInput): Promise<string | null> {
  const dir = await mkdtemp(join(tmpdir(), "vmc-terminal-"));
  const file = join(dir, `${input.mode === "claude" ? "claude" : "shell"}-on-vm.command`);
  await writeFile(file, terminalScript(input));
  await chmod(file, 0o700);
  const error = await shell.openPath(file);
  return error === "" ? null : error;
}
