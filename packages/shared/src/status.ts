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

export const TailscalePeerSchema = z.object({
  name: z.string(),
  dnsName: z.string(),
  ip: z.string().nullable(),
  online: z.boolean(),
  os: z.string().nullable(),
  isVm: z.boolean(),
});
export type TailscalePeer = z.infer<typeof TailscalePeerSchema>;

export const TailscaleStatusSchema = z.object({
  state: ConnectionState,
  backend: z.string(),
  selfName: z.string().nullable(),
  selfIp: z.string().nullable(),
  tailnet: z.string().nullable(),
  vm: VmPeerSchema.nullable(),
  peers: z.array(TailscalePeerSchema),
  checkedAt: z.number(),
});
export type TailscaleStatus = z.infer<typeof TailscaleStatusSchema>;

export const TailscaleControlResultSchema = z.object({
  ok: z.boolean(),
  error: z.string().nullable(),
  signInStarted: z.boolean(),
});
export type TailscaleControlResult = z.infer<typeof TailscaleControlResultSchema>;
