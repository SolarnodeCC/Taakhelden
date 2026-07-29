import { z } from "zod";

export const AvatarSlot = z.enum(["hat", "background", "accessory"]);
export type AvatarSlot = z.infer<typeof AvatarSlot>;

export const AvatarUnlockType = z.enum(["level", "badge", "lifetimePoints"]);
export type AvatarUnlockType = z.infer<typeof AvatarUnlockType>;

export const AvatarCatalogItem = z.object({
  id: z.string().min(1),
  slot: AvatarSlot,
  unlockType: AvatarUnlockType,
  unlockThreshold: z.number().int().nonnegative(),
  unlockBadgeId: z.string().nullable(),
  previewEmoji: z.string().min(1).max(8),
  title: z.string().min(1).max(80),
  sortOrder: z.number().int(),
});
export type AvatarCatalogItem = z.infer<typeof AvatarCatalogItem>;

export const AvatarCatalogResponse = z.object({
  items: z.array(AvatarCatalogItem),
});
export type AvatarCatalogResponse = z.infer<typeof AvatarCatalogResponse>;

export const MemberAvatarEquipped = z.object({
  hat: z.string().nullable(),
  background: z.string().nullable(),
  accessory: z.string().nullable(),
});
export type MemberAvatarEquipped = z.infer<typeof MemberAvatarEquipped>;

export const MemberAvatarState = z.object({
  memberId: z.string(),
  equipped: MemberAvatarEquipped,
  unlocked: z.array(z.string()),
  level: z.number().int().min(1),
  lifetimeEarned: z.number().int().nonnegative(),
});
export type MemberAvatarState = z.infer<typeof MemberAvatarState>;

export const EquipAvatarBody = z
  .object({
    hat: z.string().nullable().optional(),
    background: z.string().nullable().optional(),
    accessory: z.string().nullable().optional(),
  })
  .refine(
    (body) =>
      body.hat !== undefined ||
      body.background !== undefined ||
      body.accessory !== undefined,
    { message: "Minimaal één slot is verplicht." },
  );
export type EquipAvatarBody = z.infer<typeof EquipAvatarBody>;
