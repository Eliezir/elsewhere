import { execFile } from "node:child_process";
import { appendFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { UsageFileSchema, UsageSampleSchema, type UsageFile, type UsageSample, type UsageSnapshot, type UsageStatus } from "@vmc/shared";
import { checkCredentials, fetchOAuthUsage, parseCredentials, type Credentials, type FetchResult } from "./claudeOAuth";

const HISTORY_SECONDS = 8 * 24 * 60 * 60;
const MAX_HISTORY_LINES = 5000;
const SAMPLE_EVERY_SECONDS = 300;
const KEYCHAIN_SERVICE = "Claude Code-credentials";
const API_FILE = "usage-api.json";
const RECORDER_FILE = "usage.json";

const run = promisify(execFile);

export function usageDir(): string {
  return process.env.VMC_HOME ?? join(homedir(), ".vm-companion");
}

async function readText(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch {
    return null;
  }
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function parseSamples(text: string, nowSeconds: number): UsageSample[] {
  const samples: UsageSample[] = [];
  for (const line of text.split("\n").slice(-MAX_HISTORY_LINES)) {
    if (line.trim() === "") continue;
    const parsed = UsageSampleSchema.safeParse(parseJson(line));
    if (parsed.success && parsed.data.t >= nowSeconds - HISTORY_SECONDS) samples.push(parsed.data);
  }
  return samples;
}

let status: UsageStatus = { source: "none", error: null, checkedAt: null };

export function currentStatus(): UsageStatus {
  return status;
}

const FRESH_SCOPED_SECONDS = 15 * 60;

async function readFile_(dir: string, name: string): Promise<UsageFile | null> {
  const text = await readText(join(dir, name));
  const parsed = text === null ? null : UsageFileSchema.safeParse(parseJson(text));
  return parsed?.success ? parsed.data : null;
}

export function mergeUsageFiles(files: readonly (UsageFile | null)[], nowSeconds: number): UsageFile | null {
  const present = files.filter((file): file is UsageFile => file !== null).sort((a, b) => b.updatedAt - a.updatedAt);
  const newest = present[0];
  if (!newest) return null;
  const donor = present.find((file) => file.scoped.length > 0 && nowSeconds - file.updatedAt <= FRESH_SCOPED_SECONDS);
  const scoped = newest.scoped.length > 0 ? newest.scoped : (donor?.scoped ?? []);
  return {
    updatedAt: newest.updatedAt,
    fiveHour: newest.fiveHour && newest.fiveHour.resetsAt > nowSeconds ? newest.fiveHour : null,
    sevenDay: newest.sevenDay && newest.sevenDay.resetsAt > nowSeconds ? newest.sevenDay : null,
    scoped: scoped.filter((window) => window.resetsAt > nowSeconds),
  };
}

export async function readUsage(dir = usageDir(), nowSeconds = Math.floor(Date.now() / 1000)): Promise<UsageSnapshot> {
  const files = await Promise.all([readFile_(dir, API_FILE), readFile_(dir, RECORDER_FILE)]);
  const current = mergeUsageFiles(files, nowSeconds);

  const historyText = await readText(join(dir, "usage-history.jsonl"));
  const reportedStatus: UsageStatus = status.source === "none" && current ? { ...status, source: "statusline" } : status;
  return { current, samples: historyText === null ? [] : parseSamples(historyText, nowSeconds), status: reportedStatus };
}

export async function loadCredentials(): Promise<Credentials | null> {
  const fileText = await readText(join(homedir(), ".claude", ".credentials.json"));
  const fromFile = fileText === null ? null : parseCredentials(fileText);
  if (fromFile) return fromFile;
  try {
    const { stdout } = await run("security", ["find-generic-password", "-s", KEYCHAIN_SERVICE, "-w"], { timeout: 20000 });
    return parseCredentials(stdout);
  } catch {
    return null;
  }
}

export interface RefreshDeps {
  dir: string;
  now: () => number;
  load: () => Promise<Credentials | null>;
  fetchUsage: (token: string) => Promise<FetchResult>;
}

async function writeCurrent(dir: string, file: UsageFile): Promise<void> {
  await mkdir(dir, { recursive: true });
  const target = join(dir, API_FILE);
  const temporary = `${target}.${process.pid}`;
  await writeFile(temporary, `${JSON.stringify(file)}\n`);
  await rename(temporary, target);
}

async function appendSample(dir: string, file: UsageFile): Promise<void> {
  const stamp = join(dir, ".history-at");
  const last = Number((await readText(stamp)) ?? "0");
  if (file.updatedAt - last < SAMPLE_EVERY_SECONDS) return;
  const sample: UsageSample = { t: file.updatedAt, five: file.fiveHour?.usedPercentage ?? null, seven: file.sevenDay?.usedPercentage ?? null };
  await appendFile(join(dir, "usage-history.jsonl"), `${JSON.stringify(sample)}\n`);
  await writeFile(stamp, `${file.updatedAt}\n`);
}

export async function refreshUsage(deps?: Partial<RefreshDeps>): Promise<UsageStatus> {
  const resolved: RefreshDeps = {
    dir: usageDir(),
    now: () => Math.floor(Date.now() / 1000),
    load: loadCredentials,
    fetchUsage: (token) => fetchOAuthUsage(token, (url, init) => fetch(url, init)),
    ...deps,
  };
  const now = resolved.now();
  const fail = (error: string): UsageStatus => (status = { source: status.source, error, checkedAt: now });

  const credentials = await resolved.load();
  if (!credentials) return fail("No Claude login found. Sign in with Claude Code first.");
  const problem = checkCredentials(credentials, now);
  if (problem) return fail(problem);

  const result = await resolved.fetchUsage(credentials.accessToken);
  if (!result.ok) return fail(result.error);

  const { windows } = result;
  const file: UsageFile = { updatedAt: now, fiveHour: windows.fiveHour, sevenDay: windows.sevenDay, scoped: windows.scoped };
  await writeCurrent(resolved.dir, file);
  await appendSample(resolved.dir, file);
  status = { source: "oauth", error: null, checkedAt: now };
  return status;
}
