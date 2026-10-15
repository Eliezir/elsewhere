import { clipboard, shell } from "electron";
import type { ClaudeDesktopOpenResult, VmTarget } from "@vmc/shared";
import { encodeProjectPath } from "./sessions";

const HOST_PART = /^[A-Za-z0-9._:-]+$/;
const USER_PART = /^[A-Za-z0-9_][A-Za-z0-9._-]*$/;

export function handoffPrompt(path: string, sessionId: string, home = "/home/dev"): string {
  const file = `${home}/.claude/projects/${encodeProjectPath(path)}/${sessionId}.jsonl`;
  const read = `tail -n 400 ${file} | jq -r 'select(.type=="user" or .type=="assistant") | .message.content | if type=="string" then . else (map(select(.type=="text").text) | join("\n")) end' | tail -c 12000`;
  return `Pick up where the earlier conversation in this worktree stopped. Its transcript was copied to ${file}. It is very large, so don't open the whole file. Run this to read only the end:\n\n${read}\n\nThen tell me in a few lines what we were doing, what is done and what is next, and wait for my go-ahead.`;
}

export function claudeDesktopSshUrl(target: VmTarget, path: string, sessionId?: string): string | null {
  if (!HOST_PART.test(target.host) || target.host.startsWith("-") || !USER_PART.test(target.user)) return null;
  if (!path.startsWith("/") || path.includes("..") || [...path].some((character) => character.charCodeAt(0) < 32)) return null;
  const folder = encodeURIComponent(path).replace(/%2F/g, "/");
  const prompt = sessionId ? `&q=${encodeURIComponent(handoffPrompt(path, sessionId, `/home/${target.user}`))}` : "";
  return `claude://code/new?ssh_host=${encodeURIComponent(`${target.user}@${target.host}`)}&ssh_folder=${folder}${prompt}`;
}

export async function openInClaudeDesktop(target: VmTarget, path: string, sessionId?: string): Promise<ClaudeDesktopOpenResult> {
  const url = claudeDesktopSshUrl(target, path, sessionId);
  if (url === null) return { ok: false, error: "That host or folder can't be put in a link." };
  try {
    clipboard.writeText(path);
    await shell.openExternal(url);
    return { ok: true, error: null };
  } catch {
    return { ok: false, error: "Claude Desktop couldn't be opened. Is it installed?" };
  }
}
