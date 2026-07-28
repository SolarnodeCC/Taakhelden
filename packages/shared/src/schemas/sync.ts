import { z } from "zod";
import { InstanceView } from "./instance";
import { RewardView } from "./reward";

/**
 * Offline-first batch-sync (§3.11). Mutaties worden in volgorde toegepast in de
 * Family-DO; `key` is de idempotentie-sleutel (dubbel afvinken → geen dubbele
 * punten). Losse endpoints (§3.5–3.8) gebruiken dezelfde interne handlers.
 */
export const SyncMutation = z.discriminatedUnion("op", [
  z.object({ key: z.string().min(1), op: z.literal("complete"), instanceId: z.string(), at: z.string().optional() }),
  z.object({ key: z.string().min(1), op: z.literal("undo"), instanceId: z.string(), at: z.string().optional() }),
  z.object({ key: z.string().min(1), op: z.literal("redeem"), rewardId: z.string(), at: z.string().optional() }),
  z.object({
    key: z.string().min(1),
    op: z.literal("attach_photo"),
    instanceId: z.string(),
    photoId: z.string(),
    at: z.string().optional(),
  }),
]);
export type SyncMutation = z.infer<typeof SyncMutation>;

export const SyncBody = z.object({
  since: z.string().datetime().optional(),
  mutations: z.array(SyncMutation).max(200),
});
export type SyncBody = z.infer<typeof SyncBody>;

export const SyncResultStatus = z.enum(["applied", "rejected"]);

export const SyncResult = z.object({
  key: z.string(),
  status: SyncResultStatus,
  points: z.number().int().optional(),
  newBalance: z.number().int().optional(),
  code: z.string().optional(),
  message: z.string().optional(),
});
export type SyncResult = z.infer<typeof SyncResult>;

export const SyncChanges = z.object({
  ledger: z.array(z.record(z.unknown())),
  instances: z.array(InstanceView),
  rewards: z.array(RewardView).optional(),
});
export type SyncChanges = z.infer<typeof SyncChanges>;

export const SyncResponse = z.object({
  results: z.array(SyncResult),
  changes: SyncChanges,
  serverTime: z.string(),
});
export type SyncResponse = z.infer<typeof SyncResponse>;
