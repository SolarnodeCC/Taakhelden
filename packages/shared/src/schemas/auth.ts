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

/** Kindprofiel zoals getoond in de kind-loginflow (geen PII). */
export const ChildProfile = z.object({
  id: z.string(),
  displayName: z.string(),
  avatarId: z.string().nullable(),
});
export type ChildProfile = z.infer<typeof ChildProfile>;

export const TokenPair = z.object({
  accessToken: z.string(),
  refreshToken: z.string().optional(), // kind-sessies hebben geen refresh token
  expiresIn: z.number(),
});
export type TokenPair = z.infer<typeof TokenPair>;
