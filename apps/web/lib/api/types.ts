import { z } from "zod";

/**
 * Web-side view schemas for the read endpoints the shell consumes. The API
 * defines these response shapes inline (they are not exported from
 * @taakhelden/shared), so we mirror the fields we render here and parse for
 * runtime safety. `.passthrough()` keeps unknown fields we don't use yet.
 */

export const FamilyView = z
  .object({
    id: z.string(),
    name: z.string(),
    timezone: z.string().optional(),
  })
  .passthrough();
export type FamilyView = z.infer<typeof FamilyView>;

export const MemberView = z
  .object({
    id: z.string(),
    role: z.enum(["parent", "child"]),
    displayName: z.string(),
    avatarId: z.string().nullable().optional(),
    permissions: z.enum(["full", "approve_only"]).optional(),
  })
  .passthrough();
export type MemberView = z.infer<typeof MemberView>;

export const MemberList = z.array(MemberView);

export const SessionInfo = z.object({
  userId: z.string(),
  familyId: z.string(),
  role: z.enum(["parent", "child"]),
  permissions: z.enum(["full", "approve_only"]),
});
export type SessionInfo = z.infer<typeof SessionInfo>;
