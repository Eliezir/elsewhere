import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { FetchResult } from "./claudeOAuth";
import { currentStatus, mergeUsageFiles, parseSamples, readUsage, refreshUsage } from "./usage";

const NOW = 1_800_000_000;

async function dirWith(files: Record<string, string>): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "vmc-usage-"));
  for (const [name, content] of Object.entries(files)) await writeFile(join(dir, name), content);
  return dir;
}

const GOOD: FetchResult = {
  ok: true,
  windows: {
    fiveHour: { usedPercentage: 25, resetsAt: NOW + 3600 },
    sevenDay: { usedPercentage: 44, resetsAt: NOW + 86400 },
    scoped: [{ id: "seven_day_opus", title: "Opus only", usedPercentage: 31, resetsAt: NOW + 86400 }],
    fields: ["five_hour", "seven_day"],
  },
};

const LOGIN = { accessToken: "tok", expiresAt: NOW + 3600, scopes: ["user:profile"] };

describe("readUsage", () => {
  it("returns an empty snapshot when nothing has been recorded", async () => {
    const dir = await dirWith({});
    const snapshot = await readUsage(dir, NOW);
    expect(snapshot.current).toBeNull();
    expect(snapshot.samples).toEqual([]);
  });

  it("drops limit windows that have already reset", async () => {
    const file = {
      updatedAt: NOW - 60,
      fiveHour: { usedPercentage: 40, resetsAt: NOW - 10 },
      sevenDay: { usedPercentage: 12, resetsAt: NOW + 3600 },
    };
    const dir = await dirWith({ "usage.json": JSON.stringify(file) });
    const snapshot = await readUsage(dir, NOW);
    expect(snapshot.current?.fiveHour).toBeNull();
    expect(snapshot.current?.sevenDay?.usedPercentage).toBe(12);
    expect(snapshot.current?.scoped).toEqual([]);
  });

  it("ignores a corrupt usage file", async () => {
    const dir = await dirWith({ "usage.json": "{not json" });
    expect((await readUsage(dir, NOW)).current).toBeNull();
  });
});

describe("mergeUsageFiles", () => {
  const window = (used: number) => ({ usedPercentage: used, resetsAt: NOW + 3600 });
  const scoped = [{ id: "seven_day_opus", title: "Opus only", usedPercentage: 31, resetsAt: NOW + 3600 }];

  it("prefers the newest file and keeps per-model windows from a recent older one", () => {
    const api = { updatedAt: NOW - 300, fiveHour: window(20), sevenDay: window(40), scoped };
    const recorder = { updatedAt: NOW - 10, fiveHour: window(24), sevenDay: window(44), scoped: [] };
    const merged = mergeUsageFiles([api, recorder], NOW);
    expect(merged?.fiveHour?.usedPercentage).toBe(24);
    expect(merged?.scoped).toEqual(scoped);
  });

  it("drops per-model windows from a file that is too old", () => {
    const api = { updatedAt: NOW - 3600, fiveHour: window(20), sevenDay: window(40), scoped };
    const recorder = { updatedAt: NOW - 10, fiveHour: window(24), sevenDay: null, scoped: [] };
    expect(mergeUsageFiles([api, recorder], NOW)?.scoped).toEqual([]);
  });

  it("returns null when neither file exists", () => {
    expect(mergeUsageFiles([null, null], NOW)).toBeNull();
  });
});

describe("parseSamples", () => {
  it("skips bad lines and samples older than the history window", () => {
    const text = [
      JSON.stringify({ t: NOW - 100, five: 10, seven: 20 }),
      "garbage",
      JSON.stringify({ t: NOW - 30 * 24 * 3600, five: 1, seven: 1 }),
      JSON.stringify({ t: NOW - 50, five: null, seven: 21 }),
    ].join("\n");
    expect(parseSamples(text, NOW)).toEqual([
      { t: NOW - 100, five: 10, seven: 20 },
      { t: NOW - 50, five: null, seven: 21 },
    ]);
  });
});

describe("refreshUsage", () => {
  it("writes the current file and one history sample on success", async () => {
    const dir = await dirWith({});
    const status = await refreshUsage({ dir, now: () => NOW, load: async () => LOGIN, fetchUsage: async () => GOOD });
    expect(status).toMatchObject({ source: "oauth", error: null });
    const snapshot = await readUsage(dir, NOW);
    expect(snapshot.current?.fiveHour?.usedPercentage).toBe(25);
    expect(snapshot.current?.scoped[0]?.title).toBe("Opus only");
    expect(snapshot.samples).toHaveLength(1);
    expect(snapshot.status.source).toBe("oauth");
  });

  it("does not add another sample within five minutes", async () => {
    const dir = await dirWith({});
    const deps = { dir, load: async () => LOGIN, fetchUsage: async () => GOOD };
    await refreshUsage({ ...deps, now: () => NOW });
    await refreshUsage({ ...deps, now: () => NOW + 60 });
    const history = await readFile(join(dir, "usage-history.jsonl"), "utf8");
    expect(history.trim().split("\n")).toHaveLength(1);
  });

  it("reports a missing login without writing anything", async () => {
    const dir = await dirWith({});
    const status = await refreshUsage({ dir, now: () => NOW, load: async () => null, fetchUsage: async () => GOOD });
    expect(status.error).toMatch(/No Claude login/);
    expect((await readUsage(dir, NOW)).current).toBeNull();
  });

  it("keeps the last good data when a later refresh fails", async () => {
    const dir = await dirWith({});
    await refreshUsage({ dir, now: () => NOW, load: async () => LOGIN, fetchUsage: async () => GOOD });
    await refreshUsage({ dir, now: () => NOW + 600, load: async () => LOGIN, fetchUsage: async () => ({ ok: false, error: "boom" }) });
    expect(currentStatus().error).toBe("boom");
    expect((await readUsage(dir, NOW + 600)).current?.fiveHour?.usedPercentage).toBe(25);
  });
});
