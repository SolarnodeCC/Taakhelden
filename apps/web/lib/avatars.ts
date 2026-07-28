/**
 * Placeholder avatar set until the real diverse library ships.
 * Ids are stable strings stored as `avatarId` on member profiles.
 */
export const AVATAR_PLACEHOLDERS = [
  { id: "fox", emoji: "🦊" },
  { id: "owl", emoji: "🦉" },
  { id: "bear", emoji: "🐻" },
  { id: "cat", emoji: "🐱" },
  { id: "rabbit", emoji: "🐰" },
  { id: "frog", emoji: "🐸" },
  { id: "star", emoji: "⭐" },
  { id: "sun", emoji: "☀️" },
] as const;

export type AvatarPlaceholderId = (typeof AVATAR_PLACEHOLDERS)[number]["id"];

export function avatarEmoji(avatarId: string | null | undefined): string | null {
  if (!avatarId) return null;
  return AVATAR_PLACEHOLDERS.find((a) => a.id === avatarId)?.emoji ?? null;
}
