import { z } from "zod";
import { VmTargetSchema } from "./worktree";

export const GamingInputSchema = z.object({ target: VmTargetSchema, force: z.boolean().optional() });
export type GamingInput = z.infer<typeof GamingInputSchema>;

export const GamingResultSchema = z.object({
  ok: z.boolean(),
  busy: z.boolean(),
  reason: z.string().nullable(),
  error: z.string().nullable(),
});
export type GamingResult = z.infer<typeof GamingResultSchema>;
