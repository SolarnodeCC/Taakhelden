/**
 * Task and reward icons.
 *
 * `icon` is a free-form string in the shared schema, and both the schema
 * defaults ("star", "gift") and the API's starter templates ("toys", "tooth",
 * "pencil", …) store slugs. Those slugs were being rendered straight into the
 * UI, so a template task showed the literal word "pencil" where a glyph
 * belonged. `displayIcon` resolves a known slug to its glyph and passes
 * anything else through unchanged, which keeps existing rows working while new
 * ones written by the picker below store the glyph directly.
 */

const SLUG_GLYPHS: Record<string, string> = {
  // Schema defaults.
  star: "⭐",
  gift: "🎁",
  // Starter templates served by GET /api/v1/tasks/templates.
  toys: "🧸",
  tooth: "🪥",
  table: "🍽️",
  book: "📚",
  dishwasher: "🍽️",
  pencil: "✏️",
  vacuum: "🧹",
  trash: "🗑️",
};

/** Glyph for a stored icon value; falls back to the value itself. */
export function displayIcon(icon: string | null | undefined): string | null {
  if (!icon) return null;
  return SLUG_GLYPHS[icon] ?? icon;
}

/** Offered when creating a task — chores, homework and self-care. */
export const TASK_ICONS = [
  "⭐", "🧸", "🪥", "🍽️", "📚", "✏️", "🧹", "🗑️",
  "🛏️", "👕", "🐕", "🌱", "🎒", "🧮", "🎨", "🎵",
] as const;

/** Offered when creating a reward. */
export const REWARD_ICONS = [
  "🎁", "🍦", "🎮", "🎬", "🏊", "🚲", "🍕", "📱",
  "🎟️", "🧁", "⚽", "🎪",
] as const;
