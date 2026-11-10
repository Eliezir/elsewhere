import { z } from "zod";

export const LanMouseActionSchema = z.enum(["status", "share", "stop"]);
export type LanMouseAction = z.infer<typeof LanMouseActionSchema>;

export const LanMouseInputSchema = z.object({
  action: LanMouseActionSchema,
  minutes: z.number().int().min(1).max(240).nullable().optional(),
});
export type LanMouseInput = z.infer<typeof LanMouseInputSchema>;

export const LanMouseStatusSchema = z.object({
  running: z.boolean(),
  active: z.boolean(),
  clients: z.number().min(0),
  backAt: z.number().nullable(),
  error: z.string().nullable(),
});
export type LanMouseStatus = z.infer<typeof LanMouseStatusSchema>;
