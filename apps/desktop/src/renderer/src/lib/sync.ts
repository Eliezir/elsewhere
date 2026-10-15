export type SyncKind = "in-sync" | "mac-ahead" | "vm-ahead" | "both-changed";

export interface SyncInput {
  macOnly: number;
  vmOnly: number;
  macModified: number;
  vmModified: number;
}

export interface SyncPlan {
  kind: SyncKind;
  message: string;
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function describeAhead(commits: number, unsaved: number): string {
  const parts = [commits > 0 ? plural(commits, "new commit", "new commits") : null, unsaved > 0 ? plural(unsaved, "unsaved change", "unsaved changes") : null];
  return parts.filter((part): part is string => part !== null).join(" and ");
}

export function syncPlan({ macOnly, vmOnly, macModified, vmModified }: SyncInput): SyncPlan {
  const macAhead = macOnly > 0 || macModified > 0;
  const vmAhead = vmOnly > 0 || vmModified > 0;
  if (macAhead && vmAhead) return { kind: "both-changed", message: "Both copies have changes the other doesn't. Commit or merge one side by hand first." };
  if (macAhead) return { kind: "mac-ahead", message: `The Mac copy is ahead of the VM copy by ${describeAhead(macOnly, macModified)}.` };
  if (vmAhead) return { kind: "vm-ahead", message: `The VM copy is ahead of the Mac copy by ${describeAhead(vmOnly, vmModified)}.` };
  return { kind: "in-sync", message: "The Mac and VM copies match." };
}
