import { z } from "zod";
import { VmTargetSchema } from "./worktree";

const PortNumber = z.number().int().min(1).max(65535);

export const VmPortsInputSchema = z.object({
  target: VmTargetSchema,
  autoForward: z.boolean(),
});
export type VmPortsInput = z.infer<typeof VmPortsInputSchema>;

export const PortForwardStateSchema = z.enum(["off", "active", "remapped", "failed"]);
export type PortForwardState = z.infer<typeof PortForwardStateSchema>;

export const VmPortSchema = z.object({
  port: PortNumber,
  process: z.string(),
  pid: z.number().int().nullable(),
  cwd: z.string().nullable(),
  state: PortForwardStateSchema,
  localPort: PortNumber.nullable(),
});
export type VmPort = z.infer<typeof VmPortSchema>;

export const VmPortsSchema = z.object({
  reachable: z.boolean(),
  error: z.string().nullable(),
  ports: z.array(VmPortSchema),
});
export type VmPorts = z.infer<typeof VmPortsSchema>;

export const PortForwardToggleSchema = z.object({
  target: VmTargetSchema,
  port: PortNumber,
  enabled: z.boolean(),
});
export type PortForwardToggle = z.infer<typeof PortForwardToggleSchema>;

export const LocalPortSchema = z.number().int().min(1024).max(65535);

export const VmStorageInputSchema = z.object({ target: VmTargetSchema });
export type VmStorageInput = z.infer<typeof VmStorageInputSchema>;

export const StorageKindSchema = z.enum(["worktree", "hub", "home"]);
export type StorageKind = z.infer<typeof StorageKindSchema>;

export const StorageEntrySchema = z.object({
  path: z.string(),
  bytes: z.number().min(0),
  kind: StorageKindSchema,
});
export type StorageEntry = z.infer<typeof StorageEntrySchema>;

export const VmStorageSchema = z.object({
  reachable: z.boolean(),
  error: z.string().nullable(),
  diskUsedBytes: z.number().min(0),
  diskTotalBytes: z.number().min(0),
  entries: z.array(StorageEntrySchema),
});
export type VmStorage = z.infer<typeof VmStorageSchema>;
