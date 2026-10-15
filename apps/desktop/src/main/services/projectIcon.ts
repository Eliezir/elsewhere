import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { extname, join } from "node:path";
import { nativeImage } from "electron";
import type { IconChoiceResult, ProjectIcons } from "@vmc/shared";

const NAMES = ["icon", "logo", "app-icon", "favicon"] as const;
const EXTENSIONS = ["png", "svg"] as const;
const ICON_DIRS = ["", "resources", "build", "assets", "public", "static", ".github", "docs", "images", "src/assets"] as const;
const APP_ICON_PATHS = ["src-tauri/icons/icon.png", "resources/icon.png", "build/icon.png", "public/icon.png", "public/logo.svg", "public/logo.png", "public/favicon.svg", "public/favicon.png"] as const;
const MAX_BYTES = 512 * 1024;
const TARGET_SIZE = 64;

export function isFlat(bitmap: Uint8Array, tolerance = 8): boolean {
  if (bitmap.length < 4) return true;
  const low = [255, 255, 255, 255];
  const high = [0, 0, 0, 0];
  for (let index = 0; index + 3 < bitmap.length; index += 4) {
    for (let channel = 0; channel < 4; channel += 1) {
      const value = bitmap[index + channel] ?? 0;
      if (value < (low[channel] ?? 255)) low[channel] = value;
      if (value > (high[channel] ?? 0)) high[channel] = value;
    }
  }
  return high.every((top, channel) => top - (low[channel] ?? 0) <= tolerance);
}

export function candidatePaths(appDirs: readonly string[]): string[] {
  const named = (dir: string, names: readonly string[]) =>
    names.flatMap((name) => EXTENSIONS.map((extension) => (dir === "" ? `${name}.${extension}` : `${dir}/${name}.${extension}`)));

  const root = named("", NAMES.slice(0, 3));
  const apps = appDirs.flatMap((app) => APP_ICON_PATHS.map((path) => `apps/${app}/${path}`));
  const folders = ICON_DIRS.filter((dir) => dir !== "").flatMap((dir) => named(dir, NAMES));
  return [...root, ...apps, ...folders];
}

export interface IconDeps {
  listApps: (root: string) => Promise<string[]>;
  fileSize: (path: string) => Promise<number | null>;
  readSvg: (path: string) => Promise<string>;
  rasterize: (path: string) => string | null;
}

export async function findProjectIcon(root: string, deps: IconDeps): Promise<string | null> {
  const appDirs = await deps.listApps(root);
  for (const relative of candidatePaths(appDirs)) {
    const path = join(root, relative);
    const size = await deps.fileSize(path);
    if (size === null || size === 0 || size > MAX_BYTES) continue;
    if (relative.endsWith(".svg")) {
      const text = await deps.readSvg(path);
      if (text.includes("<svg")) return `data:image/svg+xml;base64,${Buffer.from(text).toString("base64")}`;
      continue;
    }
    const raster = deps.rasterize(path);
    if (raster) return raster;
  }
  return null;
}

const realDeps: IconDeps = {
  listApps: async (root) => {
    try {
      const entries = await readdir(join(root, "apps"), { withFileTypes: true });
      return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
    } catch {
      return [];
    }
  },
  fileSize: async (path) => {
    try {
      const info = await stat(path);
      return info.isFile() ? info.size : null;
    } catch {
      return null;
    }
  },
  readSvg: (path) => readFile(path, "utf8"),
  rasterize: (path) => {
    const image = nativeImage.createFromPath(path);
    if (image.isEmpty()) return null;
    const probe = image.resize({ width: 16, height: 16 });
    if (isFlat(probe.toBitmap())) return null;
    const { width, height } = image.getSize();
    const scale = TARGET_SIZE / Math.max(width, height);
    const resized = scale < 1 ? image.resize({ width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)), quality: "best" }) : image;
    return resized.toDataURL();
  },
};

const CUSTOM_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".svg"]);
const MAX_SOURCE_BYTES = 8 * 1024 * 1024;
const MAX_SVG_BYTES = 512 * 1024;
const STORED_SIZE = 128;

export function customIconsDir(): string {
  return join(process.env.VMC_HOME ?? join(homedir(), ".vm-companion"), "project-icons");
}

export function iconFileStem(repo: string): string {
  const readable = repo.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 60);
  return `${readable}-${createHash("sha256").update(repo).digest("hex").slice(0, 8)}`;
}

function dataUrlFor(file: string, bytes: Buffer): string {
  return file.endsWith(".svg") ? `data:image/svg+xml;base64,${bytes.toString("base64")}` : `data:image/png;base64,${bytes.toString("base64")}`;
}

async function readCustomIcon(repo: string, dir = customIconsDir()): Promise<string | null> {
  const stem = iconFileStem(repo);
  for (const extension of [".png", ".svg"]) {
    try {
      return dataUrlFor(extension, await readFile(join(dir, `${stem}${extension}`)));
    } catch {
      continue;
    }
  }
  return null;
}

export async function clearCustomIcon(repo: string, dir = customIconsDir()): Promise<void> {
  const stem = iconFileStem(repo);
  await Promise.all([".png", ".svg"].map((extension) => rm(join(dir, `${stem}${extension}`), { force: true })));
}

export async function saveCustomIcon(repo: string, source: string, dir = customIconsDir()): Promise<IconChoiceResult> {
  const extension = extname(source).toLowerCase();
  if (!CUSTOM_EXTENSIONS.has(extension)) return { ok: false, cancelled: false, error: "Choose a PNG, JPG, WebP or SVG image." };
  const info = await stat(source).catch(() => null);
  if (info === null || !info.isFile()) return { ok: false, cancelled: false, error: "That file couldn't be read." };
  if (info.size > MAX_SOURCE_BYTES) return { ok: false, cancelled: false, error: "That image is larger than 8 MB." };

  await mkdir(dir, { recursive: true });
  const stem = iconFileStem(repo);
  if (extension === ".svg") {
    if (info.size > MAX_SVG_BYTES) return { ok: false, cancelled: false, error: "That SVG is larger than 512 KB." };
    const text = await readFile(source, "utf8");
    if (!text.includes("<svg")) return { ok: false, cancelled: false, error: "That file isn't a valid SVG." };
    await clearCustomIcon(repo, dir);
    await writeFile(join(dir, `${stem}.svg`), text);
    return { ok: true, cancelled: false, error: null };
  }

  const image = nativeImage.createFromPath(source);
  if (image.isEmpty()) return { ok: false, cancelled: false, error: "That image couldn't be opened." };
  const { width, height } = image.getSize();
  const scale = STORED_SIZE / Math.max(width, height);
  const stored = scale < 1 ? image.resize({ width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)), quality: "best" }) : image;
  await clearCustomIcon(repo, dir);
  await writeFile(join(dir, `${stem}.png`), stored.toPNG());
  return { ok: true, cancelled: false, error: null };
}

const cache = new Map<string, { at: number; icon: string | null }>();
const CACHE_MS = 10 * 60 * 1000;

export async function getProjectIcons(projects: readonly { repo: string; path: string }[]): Promise<ProjectIcons> {
  const result: ProjectIcons = {};
  for (const project of projects) {
    if (project.repo in result) continue;
    const custom = await readCustomIcon(project.repo);
    if (custom) {
      result[project.repo] = { icon: custom, custom: true };
      continue;
    }
    const cached = cache.get(project.path);
    if (cached && Date.now() - cached.at < CACHE_MS) {
      result[project.repo] = { icon: cached.icon, custom: false };
      continue;
    }
    const icon = await findProjectIcon(project.path, realDeps).catch(() => null);
    cache.set(project.path, { at: Date.now(), icon });
    result[project.repo] = { icon, custom: false };
  }
  return result;
}
