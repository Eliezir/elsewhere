import type { TaskEntry } from "@vmc/shared";

export interface TaskGroup {
  key: string;
  title: string;
  open: number;
  done: number;
  updatedAt: number;
  threads: TaskEntry[];
}

export function groupTasks(entries: readonly TaskEntry[]): TaskGroup[] {
  const byKey = new Map<string, TaskEntry[]>();
  for (const entry of entries) byKey.set(entry.key, [...(byKey.get(entry.key) ?? []), entry]);
  return [...byKey.entries()]
    .map(([key, threads]) => {
      const sorted = [...threads].sort((a, b) => b.updatedAt - a.updatedAt);
      return {
        key,
        title: sorted[0]?.title ?? key,
        open: sorted.reduce((sum, entry) => sum + entry.open, 0),
        done: sorted.reduce((sum, entry) => sum + entry.done, 0),
        updatedAt: sorted[0]?.updatedAt ?? 0,
        threads: sorted,
      };
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function filterGroups(groups: readonly TaskGroup[], query: string): TaskGroup[] {
  const words = query.toLowerCase().split(/\s+/).filter((word) => word !== "");
  if (words.length === 0) return [...groups];
  return groups.filter((group) => {
    const haystack = [group.key, group.title, ...group.threads.flatMap((thread) => [thread.branch ?? "", thread.repo])].join(" ").toLowerCase();
    return words.every((word) => haystack.includes(word));
  });
}

export interface ChecklistItem {
  line: number;
  text: string;
  done: boolean;
}

export function checklistOf(markdown: string): ChecklistItem[] {
  return markdown.split("\n").flatMap((raw, line) => {
    const match = /^[ \t]*[-*] \[( |x|X)\]\s?(.*)$/.exec(raw);
    return match ? [{ line, text: match[2] ?? "", done: match[1] !== " " }] : [];
  });
}

export function toggleLine(markdown: string, line: number): string {
  const lines = markdown.split("\n");
  const raw = lines[line];
  if (raw === undefined) return markdown;
  lines[line] = /\[ \]/.test(raw) ? raw.replace("[ ]", "[x]") : raw.replace(/\[[xX]\]/, "[ ]");
  return lines.join("\n");
}

export function suggestedKey(branch: string | null): string {
  if (branch === null) return "";
  const jira = /\b([A-Z][A-Z0-9]+-\d+)\b/.exec(branch)?.[1];
  if (jira) return jira;
  const issue = /issue[-_/]?(\d+)/i.exec(branch)?.[1];
  if (issue) return `issue-${issue}`;
  return branch.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^[^A-Za-z0-9]+/, "").slice(0, 60);
}
