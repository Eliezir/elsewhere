import { z } from "zod";
import { VmTargetSchema } from "./worktree";

export const HostAppSchema = z.literal("lan-mouse");
export type HostApp = z.infer<typeof HostAppSchema>;

export const HostAppActionSchema = z.enum(["status", "open", "close", "setup"]);
export type HostAppAction = z.infer<typeof HostAppActionSchema>;

export const HostAppInputSchema = z.object({ target: VmTargetSchema, app: HostAppSchema, action: HostAppActionSchema });
export type HostAppInput = z.infer<typeof HostAppInputSchema>;

export const HostAppStateSchema = z.enum(["not-installed", "not-set-up", "running", "stopped", "started", "closed", "failed"]);
export type HostAppState = z.infer<typeof HostAppStateSchema>;

export const HostAppResultSchema = z.object({
  reachable: z.boolean(),
  error: z.string().nullable(),
  state: HostAppStateSchema,
});
export type HostAppResult = z.infer<typeof HostAppResultSchema>;
