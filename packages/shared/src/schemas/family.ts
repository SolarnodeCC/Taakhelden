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

export const FamilySummary = z.object({
  id: z.string(),
  name: z.string(),
  timezone: z.string(),
});
export type FamilySummary = z.infer<typeof FamilySummary>;

export const ChildFamilyView = FamilySummary.extend({
  viewer: z.literal("child"),
});
export type ChildFamilyView = z.infer<typeof ChildFamilyView>;

export const ParentFamilyView = FamilySummary.extend({
  viewer: z.literal("parent"),
  inviteCode: z.string().length(6),
  quietStart: z.string().regex(/^\d{2}:\d{2}$/),
  quietEnd: z.string().regex(/^\d{2}:\d{2}$/),
  dayBonusPoints: z.number().int().min(0),
  weekBonusPoints: z.number().int().min(0),
  weekBonusThreshold: z.number().min(0.5).max(1),
  vacationMode: z.boolean(),
});
export type ParentFamilyView = z.infer<typeof ParentFamilyView>;

export const FamilyViewerResponse = z.discriminatedUnion("viewer", [
  ChildFamilyView,
  ParentFamilyView,
]);
export type FamilyViewerResponse = z.infer<typeof FamilyViewerResponse>;

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

export const MemberView = z.object({
  id: z.string(),
  role: Role,
  displayName: z.string(),
  avatarId: z.string().nullable(),
  ageMode: AgeMode,
  birthYear: z.number().int().optional(),
});
export type MemberView = z.infer<typeof MemberView>;

/** PATCH /members/{id} — kind mag alleen eigen avatarId wijzigen. */
export const UpdateMemberBody = z.object({
  displayName: z.string().min(1).max(30).optional(),
  avatarId: z.string().optional(),
  // Zelfde ondergrens/leeftijdsvloer als CreateChildBody.birthYear — een PATCH
  // mag de "kind is minstens 3 jaar" regel niet kunnen omzeilen die bij
  // aanmaken wel geldt.
  birthYear: z.number().int().min(2005).max(new Date().getFullYear() - 3).optional(),
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
 * Response van POST /families/me/parents (Option A, P1-locked).
 * Het uitnodigingstoken zit NIET in de response — dat is een veiligheidsregel.
 * Gebruik GET /families/me/invites/:userId/link voor de kopieerbare URL.
 */
export const InviteResponse = z.object({
  userId: z.string(),
  email: z.string().email(),
  permissions: z.enum(["full", "approve_only"]),
  status: z.literal("invited"),
});
export type InviteResponse = z.infer<typeof InviteResponse>;

/**
 * Response van GET /families/me/invites/:userId/link (Option A, ouder-only).
 * Geeft een kortlevende, kopieerbare uitnodigingslink terug.
 */
export const InviteLinkResponse = z.object({
  copyableUrl: z.string().url(),
  expiresAt: z.string(),
});
export type InviteLinkResponse = z.infer<typeof InviteLinkResponse>;

/**
 * POST /families/parents/accept — de uitgenodigde verzorger accepteert: het
 * uitnodigingstoken uit de e-mail plus een eigen wachtwoord (en optioneel een
 * roepnaam). Publiek endpoint: de tweede ouder is nog niet ingelogd.
 */
export const ParentAcceptBody = z.object({
  token: z.string().min(1),
  // Gelijk aan RegisterBody: een co-ouder krijgt dezelfde rechten als de
  // ouder die registreerde, dus ook dezelfde wachtwoordeis.
  password: z.string().min(10, "Kies een wachtwoord van minstens 10 tekens."),
  displayName: z.string().min(1).max(30).optional(),
});
export type ParentAcceptBody = z.infer<typeof ParentAcceptBody>;
