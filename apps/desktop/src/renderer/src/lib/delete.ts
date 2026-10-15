import { DeleteRequestSchema, type DeleteRequest, type VmTarget } from "@vmc/shared";
import type { Worktree } from "@/data/types";

export interface DeleteOptions {
  force: boolean;
  deleteBranch: boolean;
  deleteSessions: boolean;
}

export function buildDeleteRequest(tree: Worktree, target: VmTarget, options: DeleteOptions): DeleteRequest | null {
  const parsed = DeleteRequestSchema.safeParse({
    location: tree.location,
    target: tree.location === "vm" ? target : null,
    path: tree.path,
    branch: tree.branch,
    repo: tree.repo.replace(/[^A-Za-z0-9._-]/g, "_"),
    force: options.force,
    deleteBranch: options.deleteBranch,
    deleteSessions: options.deleteSessions,
  });
  return parsed.success ? parsed.data : null;
}
