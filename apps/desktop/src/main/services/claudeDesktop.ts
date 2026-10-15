import { clipboard, shell } from "electron";
import type { ClaudeDesktopOpenResult, VmTarget } from "@vmc/shared";

const HOST_PART = /^[A-Za-z0-9._:-]+$/;
const USER_PART = /^[A-Za-z0-9_][A-Za-z0-9._-]*$/;

export function claudeDesktopSshUrl(target: VmTarget, path: string): string | null {
  if (!HOST_PART.test(target.host) || target.host.startsWith("-") || !USER_PART.test(target.user)) return null;
  if (!path.startsWith("/") || path.includes("..") || [...path].some((character) => character.charCodeAt(0) < 32)) return null;
  const folder = encodeURIComponent(path).replace(/%2F/g, "/");
  return `claude://code/new?ssh_host=${encodeURIComponent(`${target.user}@${target.host}`)}&ssh_folder=${folder}`;
}

export async function openInClaudeDesktop(target: VmTarget, path: string): Promise<ClaudeDesktopOpenResult> {
  const url = claudeDesktopSshUrl(target, path);
  if (url === null) return { ok: false, error: "That host or folder can't be put in a link." };
  try {
    clipboard.writeText(path);
    await shell.openExternal(url);
    return { ok: true, error: null };
  } catch {
    return { ok: false, error: "Claude Desktop couldn't be opened. Is it installed?" };
  }
}
