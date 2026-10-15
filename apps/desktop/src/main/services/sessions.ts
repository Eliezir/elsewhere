import { open, readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ClaudeSession } from "@vmc/shared";

const HEAD_BYTES = 256 * 1024;
const TITLE_LENGTH = 90;

export function encodeProjectPath(path: string): string {
  return path.replace(/[^a-zA-Z0-9]/g, "-");
}

export function projectsDir(): string {
  return join(homedir(), ".claude", "projects");
}

function textOf(content: unknown): string | null {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    for (const part of content) {
      if (typeof part === "object" && part !== null && (part as { type?: unknown }).type === "text") {
        const text = (part as { text?: unknown }).text;
        if (typeof text === "string") return text;
      }
    }
  }
  return null;
}

function clean(text: string): string | null {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (trimmed === "" || trimmed.startsWith("<") || trimmed.startsWith("Caveat:")) return null;
  return trimmed.length > TITLE_LENGTH ? `${trimmed.slice(0, TITLE_LENGTH - 1)}…` : trimmed;
}

export function titleFromTranscript(head: string): string {
  let firstUser: string | null = null;
  let lastPrompt: string | null = null;
  for (const line of head.split("\n").slice(0, 400)) {
    if (line === "") continue;
    let entry: unknown;
    try {
      entry = JSON.parse(line);
    } catch {
      if (firstUser === null && line.includes('"type":"user"')) {
        const match = /"content":"((?:[^"\\]|\\.)*)/.exec(line);
        firstUser = match?.[1] ? clean(match[1].replace(/\\n/g, " ").replace(/\\"/g, '"')) : null;
      }
      continue;
    }
    if (typeof entry !== "object" || entry === null) continue;
    const record = entry as { type?: unknown; lastPrompt?: unknown; summary?: unknown; message?: { content?: unknown } };
    if (record.type === "summary" && typeof record.summary === "string") {
      const summary = clean(record.summary);
      if (summary) return summary;
    }
    if (lastPrompt === null && record.type === "last-prompt" && typeof record.lastPrompt === "string") lastPrompt = clean(record.lastPrompt);
    if (firstUser === null && record.type === "user") {
      const text = textOf(record.message?.content);
      firstUser = text === null ? null : clean(text);
    }
  }
  return firstUser ?? lastPrompt ?? "Untitled session";
}

export function countLines(buffer: Buffer): number {
  let count = 0;
  for (const byte of buffer) if (byte === 10) count += 1;
  return count;
}

export function estimateLines(head: Buffer, totalSize: number): number {
  const lines = countLines(head);
  if (totalSize <= head.length || lines === 0) return lines;
  return Math.round((totalSize / head.length) * lines);
}

const cache = new Map<string, ClaudeSession>();

async function readSession(file: string, id: string): Promise<ClaudeSession | null> {
  const info = await stat(file);
  const key = `${file}:${info.mtimeMs}:${info.size}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const handle = await open(file, "r");
  try {
    const head = Buffer.alloc(Math.min(HEAD_BYTES, info.size));
    await handle.read(head, 0, head.length, 0);
    const session: ClaudeSession = {
      id,
      title: titleFromTranscript(head.toString("utf8")),
      messages: estimateLines(head, info.size),
      lastActive: Math.floor(info.mtimeMs / 1000),
    };
    cache.set(key, session);
    return session;
  } finally {
    await handle.close();
  }
}

export async function listSessions(worktreePath: string, root = projectsDir()): Promise<ClaudeSession[]> {
  const dir = join(root, encodeProjectPath(worktreePath));
  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    return [];
  }
  const sessions: ClaudeSession[] = [];
  for (const name of names) {
    if (!name.endsWith(".jsonl")) continue;
    try {
      const session = await readSession(join(dir, name), name.slice(0, -".jsonl".length));
      if (session && session.messages > 1) sessions.push(session);
    } catch {
      continue;
    }
  }
  return sessions.sort((a, b) => b.lastActive - a.lastActive);
}
