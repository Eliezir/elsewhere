import { z } from "zod";

export const TaskKeySchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,59}$/);

export const TaskEntrySchema = z.object({
  key: z.string(),
  title: z.string(),
  repo: z.string(),
  branch: z.string().nullable(),
  worktree: z.string(),
  file: z.string(),
  open: z.number().min(0),
  done: z.number().min(0),
  updatedAt: z.number(),
});
export type TaskEntry = z.infer<typeof TaskEntrySchema>;

export const TasksScanInputSchema = z.object({ repos: z.array(z.string()).max(100) });
export const TaskFileInputSchema = z.object({ file: z.string().min(1).max(2048) });
export const TaskWriteInputSchema = z.object({ file: z.string().min(1).max(2048), content: z.string().max(500_000) });
export const TaskCreateInputSchema = z.object({ worktree: z.string().min(1).max(2048), key: TaskKeySchema });
export type TaskWriteInput = z.infer<typeof TaskWriteInputSchema>;
export type TaskCreateInput = z.infer<typeof TaskCreateInputSchema>;

export const TaskContentSchema = z.object({ ok: z.boolean(), content: z.string(), updatedAt: z.number(), error: z.string().nullable() });
export type TaskContent = z.infer<typeof TaskContentSchema>;

export const TaskCreateResultSchema = z.object({ ok: z.boolean(), entry: TaskEntrySchema.nullable(), error: z.string().nullable() });
export type TaskCreateResult = z.infer<typeof TaskCreateResultSchema>;
