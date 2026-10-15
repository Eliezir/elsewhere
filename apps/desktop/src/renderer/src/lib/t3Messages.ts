import type { VmT3OpenResult } from "@vmc/shared";

export function t3Status(project: { threads: unknown[] } | undefined, hasDatabase: boolean | undefined): string {
  if (project === undefined) return hasDatabase === false ? "T3 Code has no projects on the VM yet." : "Not in T3 Code on the VM yet. Opening copies this folder's path so you can add it as a project.";
  if (project.threads.length === 0) return "Added to T3 Code on the VM. No conversation yet.";
  return `In T3 Code on the VM · ${project.threads.length} ${project.threads.length === 1 ? "conversation" : "conversations"}.`;
}

export function describeOpen(result: VmT3OpenResult): string {
  if (!result.ok) return result.error ?? "T3 Code couldn't be opened.";
  if (result.opened === "thread") return "Opened its latest conversation in T3 Code.";
  if (result.projectExists) return "T3 Code is open. Start a new conversation on this project.";
  return "T3 Code is open and the folder's path is on your clipboard. Choose the VM environment, add a project, and paste it.";
}
