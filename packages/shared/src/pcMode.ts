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

export const PowerActionSchema = z.enum(["sleep", "shutdown", "restart"]);
export type PowerAction = z.infer<typeof PowerActionSchema>;

export const PowerInputSchema = z.object({ target: VmTargetSchema, action: PowerActionSchema, force: z.boolean().optional() });
export type PowerInput = z.infer<typeof PowerInputSchema>;
