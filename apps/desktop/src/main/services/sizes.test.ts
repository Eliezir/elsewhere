import { describe, expect, it } from "vitest";
import { createSizeService, parseDu } from "./sizes";

const flush = () => new Promise((resolve) => setTimeout(resolve, 10));
const target = { host: "vm", user: "dev" };

describe("parseDu", () => {
  it("reads kilobytes into bytes and ignores noise", () => {
    expect(parseDu("1024\t/a/b\n  \nnot a line\n4\t/c d")).toEqual({ "/a/b": 1024 * 1024, "/c d": 4096 });
  });
});

describe("size service", () => {
  it("reports pending first, then cached sizes without measuring again", async () => {
    const calls: string[] = [];
    const service = createSizeService({ macDu: async (path) => (calls.push(path), path.length * 1000), vmDu: async () => ({}), now: () => 1 });
    const input = { mac: ["/a", "/bb"], vm: null };

    expect(service.get(input)).toEqual({ sizes: { "mac:/a": null, "mac:/bb": null }, pending: 2 });
    await flush();
    expect(service.get(input)).toEqual({ sizes: { "mac:/a": 2000, "mac:/bb": 3000 }, pending: 0 });
    expect(calls).toEqual(["/a", "/bb"]);
  });

  it("never measures the same path twice at once", async () => {
    let calls = 0;
    const service = createSizeService({ macDu: async () => (calls += 1, 1), vmDu: async () => ({}), now: () => 1 });
    service.get({ mac: ["/a"], vm: null });
    service.get({ mac: ["/a"], vm: null });
    await flush();
    expect(calls).toBe(1);
  });

  it("batches VM paths into one call", async () => {
    const batches: string[][] = [];
    const service = createSizeService({ macDu: async () => null, vmDu: async (_t, paths) => (batches.push([...paths]), { "/x": 10, "/y": 20 }), now: () => 1 });
    const input = { mac: [], vm: { target, paths: ["/x", "/y"] } };
    expect(service.get(input).pending).toBe(2);
    await flush();
    expect(service.get(input)).toEqual({ sizes: { "vm:/x": 10, "vm:/y": 20 }, pending: 0 });
    expect(batches).toEqual([["/x", "/y"]]);
  });

  it("measures again after the cache expires", async () => {
    let clock = 0;
    let calls = 0;
    const service = createSizeService({ macDu: async () => (calls += 1, 5), vmDu: async () => ({}), now: () => clock });
    service.get({ mac: ["/a"], vm: null });
    await flush();
    clock = 31 * 60 * 1000;
    expect(service.get({ mac: ["/a"], vm: null }).pending).toBe(1);
    await flush();
    expect(calls).toBe(2);
  });
});
