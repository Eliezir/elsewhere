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
  isMain: z.boolean(),
  merged: z.boolean(),
  upstreamGone: z.boolean(),
});

export const WorktreeListSchema = z.object({
  worktrees: z.array(WorktreeSchema),
  error: z.string().nullable(),
});

export const IconProjectSchema = z.object({
  repo: z.string().min(1).max(128),
  path: z.string().min(2).max(1024).startsWith("/"),
});

export const IconInputSchema = z.object({
  projects: z.array(IconProjectSchema).max(100),
});

export const IconRepoSchema = z.object({
  repo: z.string().min(1).max(128),
});

export const IconChoiceResultSchema = z.object({
  ok: z.boolean(),
  cancelled: z.boolean(),
  error: z.string().nullable(),
});

export type ProjectIconInfo = { icon: string | null; custom: boolean };
export type ProjectIcons = Record<string, ProjectIconInfo>;
export type IconChoiceResult = z.infer<typeof IconChoiceResultSchema>;
export type IconInput = z.infer<typeof IconInputSchema>;
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
  approvalUrl: z.string().nullable(),
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
  path: z.string().min(2).max(1024).startsWith("/").nullable(),
  mode: z.enum(["shell", "claude"]),
  sessionId: z.string().regex(/^[0-9a-fA-F-]{8,64}$/).optional(),
});

export const MacTerminalInputSchema = z.object({
  path: z.string().min(2).max(1024).startsWith("/"),
});

export type VmHealth = z.infer<typeof VmHealthSchema>;
export type VmSnapshot = z.infer<typeof VmSnapshotSchema>;
export type VmInput = z.infer<typeof VmInputSchema>;
export type MacInput = z.infer<typeof MacInputSchema>;
export type TerminalInput = z.infer<typeof TerminalInputSchema>;

export const SizeInputSchema = z.object({
  mac: z.array(z.string().min(2).max(1024).startsWith("/")).max(300),
  vm: z.object({ target: VmTargetSchema, paths: z.array(z.string().min(2).max(1024).startsWith("/")).max(300) }).nullable(),
});

export const SizeResultSchema = z.object({
  sizes: z.record(z.string(), z.number().nullable()),
  pending: z.number(),
});

export const PruneInputSchema = z.object({
  repos: z.array(z.string().max(1024)).max(50),
  vm: z.object({ target: VmTargetSchema, repos: z.array(z.string().max(1024)).max(50) }).nullable(),
});

export const PruneEntrySchema = z.object({
  location: LocationSchema,
  repo: z.string(),
  items: z.array(z.string()),
});

export const PruneResultSchema = z.object({
  entries: z.array(PruneEntrySchema),
  error: z.string().nullable(),
});

const safeName = z.string().min(1).max(128).regex(/^[A-Za-z0-9._-]+$/);
const safeBranch = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[A-Za-z0-9._/-]+$/)
  .refine((value) => !value.includes("..") && !value.startsWith("/") && !value.endsWith("/") && !value.endsWith(".lock"));

export const DeleteRequestSchema = z.object({
  location: LocationSchema,
  target: VmTargetSchema.nullable(),
  path: z.string().min(2).max(1024).startsWith("/"),
  branch: safeBranch.nullable(),
  repo: safeName.nullable(),
  force: z.boolean(),
  deleteBranch: z.boolean(),
  deleteSessions: z.boolean(),
});

export const DeleteResultSchema = z.object({
  ok: z.boolean(),
  needsForce: z.boolean(),
  error: z.string().nullable(),
  notes: z.array(z.string()),
});

export type SizeInput = z.infer<typeof SizeInputSchema>;
export type SizeResult = z.infer<typeof SizeResultSchema>;
export type PruneInput = z.infer<typeof PruneInputSchema>;
export type PruneEntry = z.infer<typeof PruneEntrySchema>;
export type PruneResult = z.infer<typeof PruneResultSchema>;
export type DeleteRequest = z.infer<typeof DeleteRequestSchema>;
export type DeleteResult = z.infer<typeof DeleteResultSchema>;

export const ToolSchema = z.enum(["conductor", "t3code"]);

export const ToolOpenInputSchema = z.object({
  tool: ToolSchema,
  path: z.string().min(2).max(1024).startsWith("/"),
});

export const ToolOpenResultSchema = z.object({
  ok: z.boolean(),
  opened: z.enum(["thread", "app"]).nullable(),
  error: z.string().nullable(),
});

export const PathsInputSchema = z.object({
  paths: z.array(z.string().min(2).max(1024).startsWith("/")).max(400),
});

export type Tool = z.infer<typeof ToolSchema>;
export type ToolInfo = { installed: boolean; name: string | null; icon: string | null };
export type ToolsInfo = Record<Tool, ToolInfo>;
export type T3Threads = Record<string, { url: string; title: string }>;
export type ToolOpenInput = z.infer<typeof ToolOpenInputSchema>;
export type ToolOpenResult = z.infer<typeof ToolOpenResultSchema>;

export const ClaudeDesktopOpenSchema = z.object({
  target: VmTargetSchema,
  path: z.string().min(2).max(1024).startsWith("/"),
  sessionId: z.string().regex(/^[0-9a-fA-F-]{8,64}$/).optional(),
});
export type ClaudeDesktopOpenResult = { ok: boolean; error: string | null };
