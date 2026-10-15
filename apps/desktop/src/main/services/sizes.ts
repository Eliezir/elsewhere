import { runLocal, runSsh, shq } from "./ssh";
import type { SizeInput, SizeResult, VmTarget } from "@vmc/shared";

const TTL_MS = 30 * 60 * 1000;
const MAC_CONCURRENCY = 2;

export function parseDu(text: string): Record<string, number> {
  const sizes: Record<string, number> = {};
  for (const line of text.split("\n")) {
    const match = /^(\d+)\s+(\/.+)$/.exec(line.trim());
    if (match?.[1] && match[2]) sizes[match[2]] = Number(match[1]) * 1024;
  }
  return sizes;
}

export interface SizeDeps {
  macDu: (path: string) => Promise<number | null>;
  vmDu: (target: VmTarget, paths: readonly string[]) => Promise<Record<string, number>>;
  now: () => number;
}

const realDeps: SizeDeps = {
  macDu: async (path) => {
    const result = await runLocal("du", ["-sk", path], { timeout: 10 * 60 * 1000 });
    return parseDu(result.stdout)[path] ?? null;
  },
  vmDu: async (target, paths) => {
    const result = await runSsh(target, `du -sk ${paths.map(shq).join(" ")} 2>/dev/null`, { timeout: 10 * 60 * 1000 });
    return parseDu(result.stdout);
  },
  now: () => Date.now(),
};

export function createSizeService(deps: SizeDeps = realDeps) {
  const cache = new Map<string, { bytes: number | null; at: number }>();
  const inflight = new Set<string>();
  const queue: string[] = [];
  let running = 0;

  const fresh = (key: string): number | null | undefined => {
    const entry = cache.get(key);
    return entry && deps.now() - entry.at < TTL_MS ? entry.bytes : undefined;
  };

  const pump = () => {
    while (running < MAC_CONCURRENCY && queue.length > 0) {
      const key = queue.shift();
      if (key === undefined) break;
      running += 1;
      void deps
        .macDu(key.slice("mac:".length))
        .catch(() => null)
        .then((bytes) => cache.set(key, { bytes, at: deps.now() }))
        .finally(() => {
          inflight.delete(key);
          running -= 1;
          pump();
        });
    }
  };

  const get = (input: SizeInput): SizeResult => {
    const sizes: Record<string, number | null> = {};
    let pending = 0;

    for (const path of input.mac) {
      const key = `mac:${path}`;
      const value = fresh(key);
      sizes[key] = value ?? null;
      if (value === undefined) {
        pending += 1;
        if (!inflight.has(key)) {
          inflight.add(key);
          queue.push(key);
        }
      }
    }
    pump();

    if (input.vm) {
      const { target, paths } = input.vm;
      const missing: string[] = [];
      for (const path of paths) {
        const key = `vm:${path}`;
        const value = fresh(key);
        sizes[key] = value ?? null;
        if (value === undefined) {
          pending += 1;
          if (!inflight.has(key)) missing.push(path);
        }
      }
      if (missing.length > 0) {
        for (const path of missing) inflight.add(`vm:${path}`);
        void deps
          .vmDu(target, missing)
          .catch(() => ({}) as Record<string, number>)
          .then((found) => {
            for (const path of missing) cache.set(`vm:${path}`, { bytes: found[path] ?? null, at: deps.now() });
          })
          .finally(() => {
            for (const path of missing) inflight.delete(`vm:${path}`);
          });
      }
    }
    return { sizes, pending };
  };

  const forget = (key: string) => cache.delete(key);
  return { get, forget };
}

export const sizeService = createSizeService();
