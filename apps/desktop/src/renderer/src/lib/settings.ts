import { useCallback, useSyncExternalStore } from "react";
import { syncActive } from "./hosts";

export interface HostProfile {
  id: string;
  name: string;
  host: string;
  user: string;
  vmRepos: string;
  mac: string;
  kind?: "vm" | "pc";
  enabled?: boolean;
}

export interface Settings {
  host: string;
  user: string;
  daemonPort: number;
  macRepos: string;
  vmRepos: string;
  hosts: HostProfile[];
  activeHostId: string;
  diskWarn: number;
  staleDays: number;
  shutdownIdle: number;
  shutdownGrace: number;
  shutdownMode: "shutdown" | "sleep";
  notifyUnreachable: boolean;
  notifyDisk: boolean;
  notifyPorts: boolean;
  startAtLogin: boolean;
  showInMenuBar: boolean;
  hideFromDock: boolean;
  runInBackground: boolean;
  autoForward: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  host: "",
  user: "dev",
  daemonPort: 7420,
  macRepos: "",
  vmRepos: "",
  hosts: [],
  activeHostId: "default",
  diskWarn: 80,
  staleDays: 30,
  shutdownIdle: 20,
  shutdownGrace: 120,
  shutdownMode: "shutdown",
  notifyUnreachable: true,
  notifyDisk: true,
  notifyPorts: true,
  startAtLogin: false,
  showInMenuBar: true,
  hideFromDock: false,
  runInBackground: true,
  autoForward: true,
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
    current = syncActive({ ...current, ...patch });
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
