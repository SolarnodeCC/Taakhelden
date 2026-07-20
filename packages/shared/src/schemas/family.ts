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

export const CreateChildBody = z.object({
  displayName: z.string().min(1).max(30),
  birthYear: z.number().int().min(2005).max(new Date().getFullYear() - 3),
  avatarId: z.string().optional(),
  pincode: z.string().regex(/^\d{4}$/),
});
