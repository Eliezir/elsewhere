import { cp, mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

const TEXT_EXTENSIONS = new Set([".jsonl", ".json", ".md", ".txt"]);

export interface VmPaths {
  hub: string;
  worktree: string;
}

export function vmPathsFor(home: string, repo: string, name: string): VmPaths {
  return {
    hub: `${home}/Developer/.vmc/${repo}.git`,
    worktree: `${home}/Developer/worktrees/${repo}/${name}`,
  };
}

export function rewritePaths(text: string, from: string, to: string): string {
  return text.split(from).join(to);
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot);
}

export async function copyRewritten(source: string, destination: string, from: string, to: string): Promise<number> {
  await mkdir(destination, { recursive: true });
  let files = 0;
  for (const entry of await readdir(source, { withFileTypes: true })) {
    const sourcePath = join(source, entry.name);
    const destinationPath = join(destination, entry.name);
    if (entry.isDirectory()) {
      files += await copyRewritten(sourcePath, destinationPath, from, to);
    } else if (entry.isFile()) {
      if (TEXT_EXTENSIONS.has(extensionOf(entry.name))) {
        await writeFile(destinationPath, rewritePaths(await readFile(sourcePath, "utf8"), from, to));
      } else {
        await cp(sourcePath, destinationPath);
      }
      files += 1;
    }
  }
  return files;
}

export async function mergeNewer(source: string, destination: string): Promise<{ copied: number; kept: number }> {
  await mkdir(destination, { recursive: true });
  let copied = 0;
  let kept = 0;
  for (const entry of await readdir(source, { withFileTypes: true })) {
    const sourcePath = join(source, entry.name);
    const destinationPath = join(destination, entry.name);
    if (entry.isDirectory()) {
      const inner = await mergeNewer(sourcePath, destinationPath);
      copied += inner.copied;
      kept += inner.kept;
    } else if (entry.isFile()) {
      const existing = await stat(destinationPath).catch(() => null);
      const incoming = await stat(sourcePath);
      if (existing === null || incoming.mtimeMs > existing.mtimeMs) {
        await cp(sourcePath, destinationPath, { preserveTimestamps: true });
        copied += 1;
      } else {
        kept += 1;
      }
    }
  }
  return { copied, kept };
}
