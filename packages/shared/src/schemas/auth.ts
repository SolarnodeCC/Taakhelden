import { z } from "zod";

export const RegisterBody = z.object({
  email: z.string().email(),
  password: z.string().min(10),
  familyName: z.string().min(1).max(50),
  displayName: z.string().min(1).max(30),
  turnstileToken: z.string(),
});

export const LoginBody = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const FamilyCodeBody = z.object({
  familyCode: z.string().length(6),
});

export const ChildSessionBody = z.object({
  familyCode: z.string().length(6),
  childId: z.string(),
  pincode: z.string().regex(/^\d{4}$/),
});

export const ChildSessionRefreshBody = z.object({
  refreshToken: z.string().min(1),
});

export const AppleAuthBody = z.object({
  identityToken: z.string().min(1),
  // Alleen gebruikt bij een eerste login (accountcreatie):
  familyName: z.string().min(1).max(50).optional(),
  displayName: z.string().min(1).max(30).optional(),
});

export const RefreshBody = z.object({
  refreshToken: z.string().min(1),
});

export const LogoutBody = z.object({
  refreshToken: z.string().min(1),
});

/** Kindprofiel zoals getoond in de kind-loginflow (geen e-mail/PII). */
export const ChildProfile = z.object({
  id: z.string(),
  displayName: z.string(),
  avatarId: z.string().nullable(),
  ageMode: z.enum(["young", "mid", "teen"]),
});
export type ChildProfile = z.infer<typeof ChildProfile>;

export const FamilyCodeResult = z.object({
  familyName: z.string(),
  children: z.array(ChildProfile),
});
export type FamilyCodeResult = z.infer<typeof FamilyCodeResult>;

export const TokenPair = z.object({
  accessToken: z.string(),
  refreshToken: z.string().optional(), // kind-sessies hebben geen refresh token
  expiresIn: z.number(),
});
export type TokenPair = z.infer<typeof TokenPair>;

export const ParentSessionResult = TokenPair.extend({
  userId: z.string(),
  familyId: z.string(),
  refreshToken: z.string(),
});
export type ParentSessionResult = z.infer<typeof ParentSessionResult>;

export const ChildSessionResult = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number(),
  child: ChildProfile,
});
export type ChildSessionResult = z.infer<typeof ChildSessionResult>;

export const RevokeChildSessionsResult = z.object({
  ok: z.literal(true),
  revokedCount: z.number().int().nonnegative(),
});
export type RevokeChildSessionsResult = z.infer<typeof RevokeChildSessionsResult>;

export const ForgotPasswordBody = z.object({
  email: z.string().email(),
});
export type ForgotPasswordBody = z.infer<typeof ForgotPasswordBody>;

export const ResetPasswordBody = z.object({
  token: z.string().min(1),
  password: z.string().min(10),
});
export type ResetPasswordBody = z.infer<typeof ResetPasswordBody>;
