import { useCallback, useSyncExternalStore } from "react";

const KEY = "vmc:worktree-names";
const listeners = new Set<() => void>();

function read(): Record<string, string> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    if (typeof parsed !== "object" || parsed === null) return {};
    return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
  } catch {
    return {};
  }
}

let current = read();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function snapshot(): Record<string, string> {
  return current;
}

export function useWorktreeNames(): [Record<string, string>, (path: string, label: string | null) => void] {
  const names = useSyncExternalStore(subscribe, snapshot);
  const set = useCallback((path: string, label: string | null) => {
    const next = { ...current };
    if (label === null) delete next[path];
    else next[path] = label;
    current = next;
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      return;
    } finally {
      listeners.forEach((listener) => listener());
    }
  }, []);
  return [names, set];
}
