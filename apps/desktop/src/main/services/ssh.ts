import { spawn } from "node:child_process";
import type { VmTarget } from "@vmc/shared";

export interface SshResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

export function shq(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export function sshBaseArgs(target: VmTarget): string[] {
  return ["-o", "BatchMode=yes", "-o", "ConnectTimeout=8", "-o", "ServerAliveInterval=10", `${target.user}@${target.host}`];
}

export function runLocal(command: string, args: readonly string[], options: { input?: Buffer | string; timeout?: number; cwd?: string } = {}): Promise<SshResult> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd: options.cwd, stdio: ["pipe", "pipe", "pipe"] });
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    const timer = options.timeout ? setTimeout(() => child.kill("SIGKILL"), options.timeout) : null;
    child.stdout.on("data", (chunk: Buffer) => out.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => err.push(chunk));
    child.on("error", (error) => {
      if (timer) clearTimeout(timer);
      resolve({ code: null, stdout: "", stderr: error.message });
    });
    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      resolve({ code, stdout: Buffer.concat(out).toString("utf8"), stderr: Buffer.concat(err).toString("utf8") });
    });
    child.stdin.on("error", () => undefined);
    child.stdin.end(options.input);
  });
}

export function runSsh(target: VmTarget, script: string, options: { timeout?: number } = {}): Promise<SshResult> {
  return runLocal("ssh", [...sshBaseArgs(target), "sh", "-s"], { input: script, timeout: options.timeout ?? 30000 });
}

export function describeSshFailure(result: SshResult): string {
  const text = result.stderr.trim().split("\n").pop() ?? "";
  if (/timed out|No route|Network is unreachable|Could not resolve/i.test(text)) return "Can't reach the VM. Is Tailscale connected?";
  if (/Permission denied|publickey/i.test(text)) return "The VM refused the SSH login. Check the user name in Settings.";
  if (result.code === null && text !== "") return text;
  return text === "" ? "The VM command failed." : text;
}
