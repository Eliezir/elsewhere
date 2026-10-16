import { app } from "electron";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { AppPrefsSchema, type AppPrefs } from "@vmc/shared";

const DEFAULTS: AppPrefs = { startAtLogin: false, runInBackground: true, showInMenuBar: true, hideFromDock: false };

let prefs: AppPrefs = DEFAULTS;
const listeners = new Set<(prefs: AppPrefs) => void>();

function prefsFile(): string {
  return join(process.env.VMC_HOME ?? join(homedir(), ".vm-companion"), "app-prefs.json");
}

export function getPrefs(): AppPrefs {
  return prefs;
}

export function onPrefsChange(listener: (prefs: AppPrefs) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function keepsRunningInBackground(value: AppPrefs): boolean {
  return value.runInBackground && value.showInMenuBar;
}

export function hidesFromDock(value: AppPrefs): boolean {
  return value.hideFromDock && value.showInMenuBar;
}

export async function loadPrefs(): Promise<void> {
  const text = await readFile(prefsFile(), "utf8").catch(() => null);
  if (text === null) return;
  try {
    const parsed = AppPrefsSchema.safeParse(JSON.parse(text));
    if (parsed.success) prefs = parsed.data;
  } catch {
    return;
  }
}

export async function setPrefs(next: AppPrefs): Promise<void> {
  const loginChanged = next.startAtLogin !== prefs.startAtLogin;
  prefs = next;
  await mkdir(join(prefsFile(), ".."), { recursive: true });
  await writeFile(prefsFile(), `${JSON.stringify(next)}\n`).catch(() => undefined);
  if (loginChanged && app.isPackaged) app.setLoginItemSettings({ openAtLogin: next.startAtLogin, args: ["--hidden"] });
  for (const listener of listeners) listener(next);
}
