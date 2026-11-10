import { z } from "zod";
import { VmTargetSchema } from "./worktree";

export const IdleActionSchema = z.enum(["shutdown", "sleep"]);
export type IdleAction = z.infer<typeof IdleActionSchema>;

export const ShutdownTargetSchema = z.object({ target: VmTargetSchema });
export type ShutdownTarget = z.infer<typeof ShutdownTargetSchema>;

export const ShutdownArmSchema = z.object({
  target: VmTargetSchema,
  idleMinutes: z.number().int().min(1).max(240),
  graceSeconds: z.number().int().min(30).max(600),
  action: IdleActionSchema.default("shutdown"),
});
export type ShutdownArm = z.infer<typeof ShutdownArmSchema>;

export const ShutdownStatusSchema = z.object({
  reachable: z.boolean(),
  error: z.string().nullable(),
  state: z.enum(["off", "watching", "counting-down"]),
  action: IdleActionSchema.nullable(),
  idleMinutes: z.number().nullable(),
  graceSeconds: z.number().nullable(),
  idleForMinutes: z.number().nullable(),
  secondsLeft: z.number().nullable(),
});
export type ShutdownStatus = z.infer<typeof ShutdownStatusSchema>;
