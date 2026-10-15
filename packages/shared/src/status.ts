import { z } from "zod";

export const ConnectionState = z.enum(["connected", "disconnected", "unknown"]);
export type ConnectionState = z.infer<typeof ConnectionState>;

export const VmPeerSchema = z.object({
  name: z.string(),
  dnsName: z.string(),
  ip: z.string().nullable(),
  online: z.boolean(),
});
export type VmPeer = z.infer<typeof VmPeerSchema>;

export const TailscaleStatusSchema = z.object({
  state: ConnectionState,
  selfName: z.string().nullable(),
  vm: VmPeerSchema.nullable(),
  checkedAt: z.number(),
});
export type TailscaleStatus = z.infer<typeof TailscaleStatusSchema>;
