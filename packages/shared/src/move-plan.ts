export type MoveDirection = "to-vm" | "to-mac";

export interface MoveStepInfo {
  id: "preflight" | "commit" | "hub" | "push" | "checkout" | "fetch" | "merge" | "sessions" | "env" | "remove";
  label: string;
}

export interface PlanInput {
  direction: MoveDirection;
  branch: string;
  modified: number;
  sessions: number;
  includeEnv: boolean;
  removeSource: boolean;
  hasEnv: boolean;
}

export function planMove(input: PlanInput): MoveStepInfo[] {
  const files = `${input.modified} modified ${input.modified === 1 ? "file" : "files"}`;
  const sessions = `${input.sessions} Claude ${input.sessions === 1 ? "session" : "sessions"}`;

  if (input.direction === "to-vm") {
    return [
      { id: "preflight", label: "Check the VM connection" },
      ...(input.modified > 0 ? [{ id: "commit" as const, label: `Commit ${files} as a WIP commit` }] : []),
      { id: "hub", label: "Prepare the project repository on the VM" },
      { id: "push", label: `Push ${input.branch} to the VM over SSH` },
      { id: "checkout", label: "Create or update the worktree on the VM" },
      ...(input.sessions > 0 ? [{ id: "sessions" as const, label: `Copy ${sessions} with paths rewritten` }] : []),
      ...(input.includeEnv && input.hasEnv ? [{ id: "env" as const, label: "Copy .env files" }] : []),
      ...(input.removeSource ? [{ id: "remove" as const, label: "Remove the Mac copy once the VM copy is verified" }] : []),
    ];
  }
  return [
    { id: "preflight", label: "Check the VM connection" },
    { id: "commit", label: "Commit any unsaved work on the VM" },
    { id: "fetch", label: `Fetch ${input.branch} from the VM` },
    { id: "merge", label: "Fast-forward the Mac worktree" },
    ...(input.sessions > 0 ? [{ id: "sessions" as const, label: `Copy ${sessions} back, keeping the newest` }] : []),
    ...(input.removeSource ? [{ id: "remove" as const, label: "Remove the VM copy once the Mac is updated" }] : []),
  ];
}
