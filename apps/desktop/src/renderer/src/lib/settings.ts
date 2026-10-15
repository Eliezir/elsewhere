import { useCallback, useSyncExternalStore } from "react";

export interface Settings {
  host: string;
  user: string;
  daemonPort: number;
  macRepos: string;
  vmRepos: string;
  diskWarn: number;
  idleLine: number;
  pacerCap: number;
  notifyUnreachable: boolean;
  notifyDisk: boolean;
  notifyIdle: boolean;
  notifyWeekly: boolean;
  notifyDigest: boolean;
  startAtLogin: boolean;
  showInMenuBar: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  host: "adt-dev.tail6ccfa6.ts.net",
  user: "dev",
  daemonPort: 7420,
  macRepos: "~/Developer/NEES/unicef/adt-studio\n~/Developer/vm-companion",
  vmRepos: "~/Developer/adt-studio",
  diskWarn: 80,
  idleLine: 20,
  pacerCap: 80,
  notifyUnreachable: true,
  notifyDisk: true,
  notifyIdle: true,
  notifyWeekly: true,
  notifyDigest: false,
  startAtLogin: false,
  showInMenuBar: true,
};

export function splitLines(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");
}

const KEY = "vmc:settings";
const listeners = new Set<() => void>();

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed === "object" && parsed !== null) return { ...DEFAULT_SETTINGS, ...(parsed as Partial<Settings>) };
    }
  } catch {
    return DEFAULT_SETTINGS;
  }
  return DEFAULT_SETTINGS;
}

let current = load();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function snapshot(): Settings {
  return current;
}

export function useSettings(): [Settings, (patch: Partial<Settings>) => void] {
  const settings = useSyncExternalStore(subscribe, snapshot);
  const update = useCallback((patch: Partial<Settings>) => {
    current = { ...current, ...patch };
    try {
      localStorage.setItem(KEY, JSON.stringify(current));
    } catch {
      return;
    } finally {
      listeners.forEach((listener) => listener());
    }
  }, []);
  return [settings, update];
}
