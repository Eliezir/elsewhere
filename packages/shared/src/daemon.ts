import { z } from "zod";

export const DaemonHealthSchema = z.object({
  ok: z.literal(true),
  uptimeSeconds: z.number().nonnegative(),
  hostname: z.string(),
  version: z.string(),
});
export type DaemonHealth = z.infer<typeof DaemonHealthSchema>;
