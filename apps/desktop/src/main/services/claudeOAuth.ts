import type { LimitWindow, ScopedWindow } from "@vmc/shared";

const USAGE_URL = "https://api.anthropic.com/api/oauth/usage";
const REQUIRED_SCOPE = "user:profile";
const EXPIRY_MARGIN_SECONDS = 60;
const NON_MODEL_WINDOWS = new Set(["routines", "cowork", "omelette", "oauth_apps"]);

export interface Credentials {
  accessToken: string;
  expiresAt: number | null;
  scopes: readonly string[];
}

export interface UsageWindows {
  fiveHour: LimitWindow | null;
  sevenDay: LimitWindow | null;
  scoped: ScopedWindow[];
  fields: string[];
}

export type FetchResult = { ok: true; windows: UsageWindows } | { ok: false; error: string };

type FetchFn = (url: string, init: { headers: Record<string, string>; signal: AbortSignal }) => Promise<{ status: number; json: () => Promise<unknown> }>;

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

export function parseCredentials(text: string): Credentials | null {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return null;
  }
  const oauth = asRecord(asRecord(json)?.claudeAiOauth);
  if (!oauth || typeof oauth.accessToken !== "string" || oauth.accessToken === "") return null;
  return {
    accessToken: oauth.accessToken,
    expiresAt: typeof oauth.expiresAt === "number" ? Math.floor(oauth.expiresAt / 1000) : null,
    scopes: Array.isArray(oauth.scopes) ? oauth.scopes.filter((scope): scope is string => typeof scope === "string") : [],
  };
}

export function checkCredentials(credentials: Credentials, nowSeconds: number): string | null {
  if (credentials.expiresAt !== null && credentials.expiresAt - EXPIRY_MARGIN_SECONDS <= nowSeconds) {
    return "The Claude login has expired. Send any message in Claude Code to refresh it.";
  }
  if (credentials.scopes.length > 0 && !credentials.scopes.includes(REQUIRED_SCOPE)) {
    return "The Claude login lacks the usage scope. Run /login in Claude Code, then refresh.";
  }
  return null;
}

function toWindow(value: unknown): LimitWindow | null {
  const record = asRecord(value);
  if (!record || typeof record.utilization !== "number") return null;
  const resets = record.resets_at;
  const resetsAt = typeof resets === "string" ? Date.parse(resets) / 1000 : typeof resets === "number" ? resets : Number.NaN;
  if (!Number.isFinite(resetsAt)) return null;
  return { usedPercentage: record.utilization, resetsAt: Math.round(resetsAt) };
}

function titleFor(name: string): string {
  return `${name.charAt(0).toUpperCase()}${name.slice(1).replace(/_/g, " ")} only`;
}

function parseTime(value: unknown): number | null {
  const seconds = typeof value === "string" ? Date.parse(value) / 1000 : typeof value === "number" ? value : Number.NaN;
  return Number.isFinite(seconds) ? Math.round(seconds) : null;
}

export function scopedFromLimits(limits: unknown): ScopedWindow[] {
  if (!Array.isArray(limits)) return [];
  const windows: ScopedWindow[] = [];
  for (const entry of limits) {
    const record = asRecord(entry);
    if (!record || record.kind !== "weekly_scoped" || typeof record.percent !== "number") continue;
    const name = asRecord(asRecord(record.scope)?.model)?.display_name;
    const resetsAt = parseTime(record.resets_at);
    if (typeof name !== "string" || name === "" || resetsAt === null) continue;
    windows.push({ id: `weekly_scoped:${name}`, title: `${name} only`, usedPercentage: record.percent, resetsAt });
  }
  return windows;
}

export function parseUsageResponse(json: unknown): UsageWindows | null {
  const record = asRecord(json);
  if (!record) return null;

  const scoped: ScopedWindow[] = scopedFromLimits(record.limits);
  for (const [key, value] of Object.entries(record)) {
    const match = /^seven_day_(.+)$/.exec(key);
    const name = match?.[1];
    if (!name || NON_MODEL_WINDOWS.has(name)) continue;
    const window = toWindow(value);
    const title = titleFor(name);
    if (window && !scoped.some((existing) => existing.title === title)) scoped.push({ id: key, title, ...window });
  }

  return {
    fiveHour: toWindow(record.five_hour),
    sevenDay: toWindow(record.seven_day),
    scoped,
    fields: Object.keys(record),
  };
}

export function describeHttpFailure(status: number): string {
  if (status === 401) return "Claude rejected the login (401). Send any message in Claude Code to refresh it.";
  if (status === 403) return "Claude refused the usage request (403). The login may lack the usage scope; run /login in Claude Code.";
  if (status === 429) return "Claude is rate limiting usage checks (429). The app will retry shortly.";
  return `Claude's usage endpoint answered ${status}.`;
}

async function request(fetchFn: FetchFn, token: string, withFlag: boolean) {
  return fetchFn(withFlag ? `${USAGE_URL}?cedar_ember=1` : USAGE_URL, {
    headers: {
      Authorization: `Bearer ${token}`,
      "anthropic-beta": "oauth-2025-04-20",
      Accept: "application/json",
      "User-Agent": "vm-companion",
    },
    signal: AbortSignal.timeout(10000),
  });
}

export async function fetchOAuthUsage(token: string, fetchFn: FetchFn): Promise<FetchResult> {
  try {
    let response = await request(fetchFn, token, true);
    if (response.status === 400 || response.status === 403) response = await request(fetchFn, token, false);
    if (response.status !== 200) return { ok: false, error: describeHttpFailure(response.status) };
    const windows = parseUsageResponse(await response.json());
    if (!windows) return { ok: false, error: "Claude's usage response had an unexpected shape." };
    if (!windows.fiveHour && !windows.sevenDay) {
      return { ok: false, error: `Claude's usage response had no limit windows (fields: ${windows.fields.join(", ") || "none"}).` };
    }
    return { ok: true, windows };
  } catch {
    return { ok: false, error: "Couldn't reach Claude's usage endpoint. Check your connection." };
  }
}
