import { z } from "zod";

export const LimitWindowSchema = z.object({
  usedPercentage: z.number(),
  resetsAt: z.number(),
});

export const ScopedWindowSchema = z.object({
  id: z.string(),
  title: z.string(),
  usedPercentage: z.number(),
  resetsAt: z.number(),
});

export const UsageFileSchema = z.object({
  updatedAt: z.number(),
  fiveHour: LimitWindowSchema.nullable(),
  sevenDay: LimitWindowSchema.nullable(),
  scoped: z.array(ScopedWindowSchema).default([]),
});

export const UsageStatusSchema = z.object({
  source: z.enum(["oauth", "statusline", "none"]),
  error: z.string().nullable(),
  checkedAt: z.number().nullable(),
});

export const UsageSampleSchema = z.object({
  t: z.number(),
  five: z.number().nullable(),
  seven: z.number().nullable(),
});

export const UsageSnapshotSchema = z.object({
  current: UsageFileSchema.nullable(),
  samples: z.array(UsageSampleSchema),
  status: UsageStatusSchema,
});

export type ScopedWindow = z.infer<typeof ScopedWindowSchema>;
export type UsageStatus = z.infer<typeof UsageStatusSchema>;
export type LimitWindow = z.infer<typeof LimitWindowSchema>;
export type UsageFile = z.infer<typeof UsageFileSchema>;
export type UsageSample = z.infer<typeof UsageSampleSchema>;
export type UsageSnapshot = z.infer<typeof UsageSnapshotSchema>;
