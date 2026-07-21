import { z } from "zod";

export const Role = z.enum(["parent", "child"]);
export const AgeMode = z.enum(["young", "mid", "teen"]);

export const FamilySettings = z.object({
  name: z.string().min(1).max(50),
  timezone: z.string().default("Europe/Amsterdam"),
  quietStart: z.string().regex(/^\d{2}:\d{2}$/).default("19:30"),
  quietEnd: z.string().regex(/^\d{2}:\d{2}$/).default("07:00"),
  dayBonusPoints: z.number().int().min(0).default(20),
  weekBonusPoints: z.number().int().min(0).default(100),
  weekBonusThreshold: z.number().min(0.5).max(1).default(0.8),
  vacationMode: z.boolean().default(false),
});
export type FamilySettings = z.infer<typeof FamilySettings>;

/** PATCH /families/me — alle instellingen optioneel. */
export const FamilyPatchBody = FamilySettings.partial();
export type FamilyPatchBody = z.infer<typeof FamilyPatchBody>;

export const CreateChildBody = z.object({
  displayName: z.string().min(1).max(30),
  birthYear: z.number().int().min(2005).max(new Date().getFullYear() - 3),
  avatarId: z.string().optional(),
  pincode: z.string().regex(/^\d{4}$/),
});
export type CreateChildBody = z.infer<typeof CreateChildBody>;

/** PATCH /members/{id} — kind mag alleen eigen avatarId wijzigen. */
export const UpdateMemberBody = z.object({
  displayName: z.string().min(1).max(30).optional(),
  avatarId: z.string().optional(),
  birthYear: z.number().int().min(2005).optional(),
});
export type UpdateMemberBody = z.infer<typeof UpdateMemberBody>;

export const PincodeBody = z.object({
  pincode: z.string().regex(/^\d{4}$/),
});

/** POST /families/me/parents — tweede verzorger uitnodigen per e-mail. */
export const InviteParentBody = z.object({
  email: z.string().email(),
  permissions: z.enum(["full", "approve_only"]).default("approve_only"),
});
export type InviteParentBody = z.infer<typeof InviteParentBody>;

/**
 * POST /families/parents/accept — de uitgenodigde verzorger accepteert: het
 * uitnodigingstoken uit de e-mail plus een eigen wachtwoord (en optioneel een
 * roepnaam). Publiek endpoint: de tweede ouder is nog niet ingelogd.
 */
export const ParentAcceptBody = z.object({
  token: z.string().min(1),
  password: z.string().min(8, "Kies een wachtwoord van minstens 8 tekens."),
  displayName: z.string().min(1).max(30).optional(),
});
export type ParentAcceptBody = z.infer<typeof ParentAcceptBody>;
