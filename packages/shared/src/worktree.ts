import { z } from "zod";

export const LocationSchema = z.enum(["mac", "vm"]);

export const ClaudeSessionSchema = z.object({
  id: z.string(),
  title: z.string(),
  messages: z.number(),
  lastActive: z.number(),
});

export const WorktreeSchema = z.object({
  id: z.string(),
  name: z.string(),
  repo: z.string(),
  branch: z.string().nullable(),
  head: z.string(),
  location: LocationSchema,
  path: z.string(),
  modified: z.number(),
  ahead: z.number(),
  behind: z.number(),
  lastActive: z.number(),
  sessions: z.array(ClaudeSessionSchema),
  hasEnv: z.boolean(),
});

export const WorktreeListSchema = z.object({
  worktrees: z.array(WorktreeSchema),
  error: z.string().nullable(),
});

export type Location = z.infer<typeof LocationSchema>;
export type ClaudeSession = z.infer<typeof ClaudeSessionSchema>;
export type Worktree = z.infer<typeof WorktreeSchema>;
export type WorktreeList = z.infer<typeof WorktreeListSchema>;

export const VmTargetSchema = z.object({
  host: z.string().min(1).max(253).regex(/^[A-Za-z0-9.-]+$/),
  user: z.string().min(1).max(64).regex(/^[a-z_][a-z0-9_-]*$/),
});

export type VmTarget = z.infer<typeof VmTargetSchema>;

export const VmHealthSchema = z.object({
  cpu: z.number(),
  cores: z.number(),
  memUsedGb: z.number(),
  memTotalGb: z.number(),
  diskUsedGb: z.number(),
  diskTotalGb: z.number(),
  uptimeSeconds: z.number(),
  claudeInstalled: z.boolean(),
  gitVersion: z.string().nullable(),
  loadSeries: z.array(z.number()),
});

export const VmSnapshotSchema = z.object({
  reachable: z.boolean(),
  error: z.string().nullable(),
  latencyMs: z.number().nullable(),
  health: VmHealthSchema.nullable(),
  worktrees: z.array(WorktreeSchema),
});

export const VmInputSchema = z.object({
  target: VmTargetSchema,
  repos: z.array(z.string().max(1024)).max(50),
});

export const MacInputSchema = z.object({
  repos: z.array(z.string().max(1024)).max(50),
});

export const TerminalInputSchema = z.object({
  target: VmTargetSchema,
  path: z.string().min(2).max(1024).startsWith("/"),
  mode: z.enum(["shell", "claude"]),
});

export type VmHealth = z.infer<typeof VmHealthSchema>;
export type VmSnapshot = z.infer<typeof VmSnapshotSchema>;
export type VmInput = z.infer<typeof VmInputSchema>;
export type MacInput = z.infer<typeof MacInputSchema>;
export type TerminalInput = z.infer<typeof TerminalInputSchema>;
