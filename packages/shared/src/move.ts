import { z } from "zod";
import { VmTargetSchema } from "./worktree";

const safeName = z.string().min(1).max(128).regex(/^[A-Za-z0-9._-]+$/);
const safeBranch = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[A-Za-z0-9._/-]+$/)
  .refine((value) => !value.includes("..") && !value.startsWith("/") && !value.endsWith("/") && !value.endsWith(".lock"));
const absolutePath = z.string().min(2).max(1024).startsWith("/");

export const MoveRequestSchema = z.object({
  direction: z.enum(["to-vm", "to-mac"]),
  target: VmTargetSchema,
  repo: safeName,
  name: safeName,
  branch: safeBranch,
  macPath: absolutePath,
  vmPath: absolutePath.nullable(),
  includeEnv: z.boolean(),
});

export const MoveProgressSchema = z.object({
  step: z.string(),
  status: z.enum(["running", "done", "failed"]),
  detail: z.string().nullable(),
});

export const MoveResultSchema = z.object({
  ok: z.boolean(),
  error: z.string().nullable(),
  note: z.string().nullable(),
  vmPath: z.string().nullable(),
});

export type MoveRequest = z.infer<typeof MoveRequestSchema>;
export type MoveProgress = z.infer<typeof MoveProgressSchema>;
export type MoveResult = z.infer<typeof MoveResultSchema>;
