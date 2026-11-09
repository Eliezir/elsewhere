export interface StorageSample {
  at: number;
  freeBytes: number;
}

export type StorageHistory = Record<string, StorageSample[]>;

const KEY = "vmc:storage-history";
const MAX_SAMPLES = 240;
const MIN_GAP_MS = 20 * 60 * 1000;

export function recordSample(history: StorageHistory, id: string, freeBytes: number, now: number): StorageHistory {
  const samples = history[id] ?? [];
  const last = samples[samples.length - 1];
  if (last && now - last.at < MIN_GAP_MS) return history;
  return { ...history, [id]: [...samples, { at: now, freeBytes }].slice(-MAX_SAMPLES) };
}

export function changeOver(samples: readonly StorageSample[], now: number, windowMs: number): number | null {
  const latest = samples[samples.length - 1];
  if (!latest) return null;
  const from = samples.find((sample) => now - sample.at <= windowMs);
  if (!from || from === latest) return null;
  return latest.freeBytes - from.freeBytes;
}

export function loadHistory(): StorageHistory {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return typeof parsed === "object" && parsed !== null ? (parsed as StorageHistory) : {};
  } catch {
    return {};
  }
}

export function saveHistory(history: StorageHistory): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(history));
  } catch {
    return;
  }
}

export function homeRelative(path: string): string {
  return path.replace(/^\/(?:Users|home)\/[^/]+/, "~");
}

export function formatChange(bytes: number, formatBytes: (value: number) => string): string {
  return `${bytes < 0 ? "−" : "+"}${formatBytes(Math.abs(bytes))}`;
}
