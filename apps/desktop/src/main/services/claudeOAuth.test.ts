import { describe, expect, it } from "vitest";
import { scopedFromLimits, checkCredentials, describeHttpFailure, fetchOAuthUsage, parseCredentials, parseUsageResponse } from "./claudeOAuth";

const RESPONSE = {
  five_hour: { utilization: 25, resets_at: "2026-10-15T05:49:59Z" },
  seven_day: { utilization: 44.4, resets_at: "2026-10-16T12:59:59Z" },
  seven_day_opus: { utilization: 31, resets_at: "2026-10-16T12:59:59Z" },
  seven_day_sonnet: null,
  seven_day_routines: { utilization: 5, resets_at: "2026-10-16T12:59:59Z" },
  extra_usage: { is_enabled: false },
};

function fakeFetch(statuses: number[], body: unknown = RESPONSE) {
  const urls: string[] = [];
  const fn = async (url: string) => {
    urls.push(url);
    const status = statuses[Math.min(urls.length - 1, statuses.length - 1)] ?? 500;
    return { status, json: async () => body };
  };
  return { fn, urls };
}

describe("parseCredentials", () => {
  it("reads the Claude Code OAuth entry", () => {
    const text = JSON.stringify({ claudeAiOauth: { accessToken: "tok", expiresAt: 2_000_000_000_000, scopes: ["user:profile"] } });
    expect(parseCredentials(text)).toEqual({ accessToken: "tok", expiresAt: 2_000_000_000, scopes: ["user:profile"] });
  });

  it("returns null without an OAuth entry or on bad JSON", () => {
    expect(parseCredentials(JSON.stringify({ mcpOAuth: {} }))).toBeNull();
    expect(parseCredentials("nope")).toBeNull();
  });
});

describe("checkCredentials", () => {
  const base = { accessToken: "tok", expiresAt: 2_000, scopes: ["user:profile"] };

  it("accepts a fresh token with the usage scope", () => {
    expect(checkCredentials(base, 1_000)).toBeNull();
  });

  it("flags an expired token", () => {
    expect(checkCredentials(base, 1_990)).toMatch(/expired/);
  });

  it("flags a token without the usage scope", () => {
    expect(checkCredentials({ ...base, scopes: ["user:inference"] }, 1_000)).toMatch(/scope/);
  });
});

describe("parseUsageResponse", () => {
  it("maps windows and model-scoped weeklies, skipping non-model keys", () => {
    const parsed = parseUsageResponse(RESPONSE);
    expect(parsed?.fiveHour?.usedPercentage).toBe(25);
    expect(parsed?.sevenDay?.resetsAt).toBe(Date.parse("2026-10-16T12:59:59Z") / 1000);
    expect(parsed?.scoped.map((window) => window.title)).toEqual(["Opus only"]);
    expect(parsed?.fields).toContain("extra_usage");
  });
});

describe("scopedFromLimits", () => {
  it("reads weekly_scoped entries using the model display name", () => {
    const limits = [
      { kind: "session", percent: 25, resets_at: "2026-10-15T05:49:59Z", scope: null },
      { kind: "weekly_all", percent: 44, resets_at: "2026-10-16T12:59:59Z", scope: null },
      { kind: "weekly_scoped", percent: 12.5, resets_at: "2026-10-16T12:59:59Z", scope: { model: { id: null, display_name: "Fable" }, surface: null } },
      { kind: "weekly_scoped", percent: 3, resets_at: "bad", scope: { model: { display_name: "Broken" } } },
    ];
    expect(scopedFromLimits(limits)).toEqual([
      { id: "weekly_scoped:Fable", title: "Fable only", usedPercentage: 12.5, resetsAt: Date.parse("2026-10-16T12:59:59Z") / 1000 },
    ]);
  });

  it("returns nothing when limits is absent", () => {
    expect(scopedFromLimits(undefined)).toEqual([]);
  });
});

describe("fetchOAuthUsage", () => {
  it("returns windows on success without retrying", async () => {
    const { fn, urls } = fakeFetch([200]);
    const result = await fetchOAuthUsage("tok", fn);
    expect(result.ok).toBe(true);
    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain("cedar_ember=1");
  });

  it("retries once without the flag after a 403", async () => {
    const { fn, urls } = fakeFetch([403, 200]);
    const result = await fetchOAuthUsage("tok", fn);
    expect(result.ok).toBe(true);
    expect(urls[1]).not.toContain("cedar_ember");
  });

  it("explains a rejected login and never includes the token", async () => {
    const { fn } = fakeFetch([401]);
    const result = await fetchOAuthUsage("secret-token", fn);
    expect(result).toEqual({ ok: false, error: describeHttpFailure(401) });
    expect(JSON.stringify(result)).not.toContain("secret-token");
  });

  it("reports the field names when no windows are present", async () => {
    const { fn } = fakeFetch([200], { something_else: {} });
    const result = await fetchOAuthUsage("tok", fn);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toContain("something_else");
  });
});
