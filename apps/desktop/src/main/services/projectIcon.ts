import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { nativeImage } from "electron";

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

const cache = new Map<string, { at: number; icon: string | null }>();
const CACHE_MS = 10 * 60 * 1000;

export async function getProjectIcons(projects: readonly { repo: string; path: string }[]): Promise<Record<string, string | null>> {
  const result: Record<string, string | null> = {};
  for (const project of projects) {
    if (project.repo in result) continue;
    const cached = cache.get(project.path);
    if (cached && Date.now() - cached.at < CACHE_MS) {
      result[project.repo] = cached.icon;
      continue;
    }
    const icon = await findProjectIcon(project.path, realDeps).catch(() => null);
    cache.set(project.path, { at: Date.now(), icon });
    result[project.repo] = icon;
  }
  return result;
}
