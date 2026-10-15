import { spawn } from "node:child_process";
import { shell } from "electron";
import type { TailscaleControlResult } from "@vmc/shared";
import { TAILSCALE_APP } from "../config";
import { findTailscaleCli } from "./tailscale";
import { extractLoginUrl } from "./urls";

const START_WAIT_MS = 15000;
const UP_TIMEOUT_MS = 25000;

const FORBIDDEN_FLAGS = new Set(["--reset", "--force-reauth", "--authkey", "--auth-key", "--qr"]);
const FLAG_SHAPE = /^--[a-z][a-z-]*(=[A-Za-z0-9_.,:/@-]*)?$/;

export function extractSuggestedFlags(output: string): string[] | null {
  const line = output
    .split("\n")
    .map((entry) => entry.trim())
    .find((entry) => /^tailscale up\s/.test(entry));
  if (!line) return null;
  const parts = line.split(/\s+/).slice(2);
  const safe = parts.length > 0 && parts.every((part) => FLAG_SHAPE.test(part) && !FORBIDDEN_FLAGS.has(part.split("=")[0] ?? ""));
  return safe ? parts : null;
}

export function needsExplicitFlags(output: string): boolean {
  return /non-default flags|non-default settings/i.test(output);
}

export function interpretUp(output: string, code: number | null): TailscaleControlResult {
  if (code === 0) return { ok: true, error: null, signInStarted: false };
  const url = extractLoginUrl(output);
  if (url) return { ok: false, error: null, signInStarted: true };
  if (needsExplicitFlags(output)) {
    return { ok: false, error: "Tailscale has custom settings, so it can't be reconnected from here. Use the Tailscale app once.", signInStarted: false };
  }
  const last = output.trim().split("\n").filter((line) => line.trim() !== "").pop();
  return { ok: false, error: last ?? "Tailscale didn't connect.", signInStarted: false };
}

function runCli(cli: string, args: readonly string[], timeoutMs: number, stopAtUrl: boolean): Promise<{ code: number | null; output: string; url: string | null }> {
  return new Promise((resolve) => {
    const child = spawn(cli, args, { stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    let url: string | null = null;
    let settled = false;
    const finish = (code: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code, output, url });
    };
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      finish(null);
    }, timeoutMs);
    const onData = (chunk: Buffer) => {
      output += chunk.toString("utf8");
      url = url ?? extractLoginUrl(output);
      if (stopAtUrl && url) {
        child.kill("SIGTERM");
        finish(null);
      }
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.on("error", (error) => {
      output += error.message;
      finish(null);
    });
    child.on("close", (code) => finish(code));
  });
}

async function backendReachable(cli: string): Promise<boolean> {
  const result = await runCli(cli, ["status", "--json"], 5000, false);
  return result.code === 0 || (result.output.includes('"BackendState"') && !/failed to connect|not running|Failed to load/i.test(result.output));
}

async function ensureRunning(cli: string): Promise<boolean> {
  if (await backendReachable(cli)) return true;
  await shell.openPath(TAILSCALE_APP);
  const deadline = Date.now() + START_WAIT_MS;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    if (await backendReachable(cli)) return true;
  }
  return false;
}

export async function connectTailscale(): Promise<TailscaleControlResult> {
  const cli = findTailscaleCli();
  if (cli === null) return { ok: false, error: "Tailscale isn't installed. Get it from tailscale.com/download.", signInStarted: false };
  if (!(await ensureRunning(cli))) return { ok: false, error: "The Tailscale app didn't start. Open it from Applications.", signInStarted: false };

  let result = await runCli(cli, ["up", "--timeout=20s"], UP_TIMEOUT_MS, true);
  if (result.code !== 0 && needsExplicitFlags(result.output)) {
    const flags = extractSuggestedFlags(result.output);
    if (flags) result = await runCli(cli, ["up", ...flags, "--timeout=20s"], UP_TIMEOUT_MS, true);
  }
  const interpreted = interpretUp(result.output, result.code);
  if (interpreted.signInStarted && result.url) await shell.openExternal(result.url);
  return interpreted;
}

export async function disconnectTailscale(): Promise<TailscaleControlResult> {
  const cli = findTailscaleCli();
  if (cli === null) return { ok: false, error: "Tailscale isn't installed.", signInStarted: false };
  const result = await runCli(cli, ["down"], 15000, false);
  if (result.code === 0) return { ok: true, error: null, signInStarted: false };
  const last = result.output.trim().split("\n").pop();
  return { ok: false, error: last && last !== "" ? last : "Tailscale didn't disconnect.", signInStarted: false };
}
