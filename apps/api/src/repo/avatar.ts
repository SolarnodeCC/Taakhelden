/**
 * Avatar-catalogus + equipped state. Unlock is afgeleid van lifetime/level/badges —
 * nooit via ledger-spend (Phase 3 E2).
 */
import type { AvatarCatalogItem, AvatarSlot, EquipAvatarBody, MemberAvatarState } from "@taakhelden/shared";
import { listEarnedIds } from "./badges";
import { lifetimeEarned } from "./ledger";

export interface AvatarCatalogRow {
  id: string;
  slot: AvatarSlot;
  unlock_type: "level" | "badge" | "lifetimePoints";
  unlock_threshold: number;
  unlock_badge_id: string | null;
  preview_emoji: string;
  title: string;
  sort_order: number;
}

export function mapCatalogRow(row: AvatarCatalogRow): AvatarCatalogItem {
  return {
    id: row.id,
    slot: row.slot,
    unlockType: row.unlock_type,
    unlockThreshold: row.unlock_threshold,
    unlockBadgeId: row.unlock_badge_id,
    previewEmoji: row.preview_emoji,
    title: row.title,
    sortOrder: row.sort_order,
  };
}

export async function listAvatarCatalog(db: D1Database): Promise<AvatarCatalogItem[]> {
  const { results } = await db
    .prepare(
      `SELECT id, slot, unlock_type, unlock_threshold, unlock_badge_id, preview_emoji, title, sort_order
       FROM avatar_catalog
       ORDER BY sort_order, id`,
    )
    .all<AvatarCatalogRow>();
  return results.map(mapCatalogRow);
}

export async function getCatalogItem(
  db: D1Database,
  itemId: string,
): Promise<AvatarCatalogItem | null> {
  const row = await db
    .prepare(
      `SELECT id, slot, unlock_type, unlock_threshold, unlock_badge_id, preview_emoji, title, sort_order
       FROM avatar_catalog WHERE id = ?`,
    )
    .bind(itemId)
    .first<AvatarCatalogRow>();
  return row ? mapCatalogRow(row) : null;
}

export function levelFromLifetime(lifetime: number): number {
  return Math.max(1, Math.floor(lifetime / 100));
}

export function isItemUnlocked(
  item: AvatarCatalogItem,
  ctx: { level: number; lifetimeEarned: number; earnedBadgeIds: Set<string> },
): boolean {
  switch (item.unlockType) {
    case "level":
      return ctx.level >= item.unlockThreshold;
    case "lifetimePoints":
      return ctx.lifetimeEarned >= item.unlockThreshold;
    case "badge":
      return item.unlockBadgeId != null && ctx.earnedBadgeIds.has(item.unlockBadgeId);
    default:
      return false;
  }
}

export async function getMemberAvatarState(
  db: D1Database,
  familyId: string,
  memberId: string,
): Promise<MemberAvatarState | null> {
  const row = await db
    .prepare(
      `SELECT id, role, equipped_hat, equipped_background, equipped_accessory
       FROM users WHERE family_id = ? AND id = ? AND deleted_at IS NULL`,
    )
    .bind(familyId, memberId)
    .first<{
      id: string;
      role: string;
      equipped_hat: string | null;
      equipped_background: string | null;
      equipped_accessory: string | null;
    }>();
  if (!row || row.role !== "child") return null;

  const [lifetime, catalogue, earnedBadgeIds] = await Promise.all([
    lifetimeEarned(db, familyId, memberId),
    listAvatarCatalog(db),
    listEarnedIds(db, familyId, memberId),
  ]);
  const level = levelFromLifetime(lifetime);
  const unlocked = catalogue
    .filter((item) => isItemUnlocked(item, { level, lifetimeEarned: lifetime, earnedBadgeIds }))
    .map((item) => item.id);

  return {
    memberId,
    equipped: {
      hat: row.equipped_hat,
      background: row.equipped_background,
      accessory: row.equipped_accessory,
    },
    unlocked,
    level,
    lifetimeEarned: lifetime,
  };
}

export async function equipAvatarItems(
  db: D1Database,
  familyId: string,
  memberId: string,
  body: EquipAvatarBody,
): Promise<MemberAvatarState | null> {
  const state = await getMemberAvatarState(db, familyId, memberId);
  if (!state) return null;

  const unlocked = new Set(state.unlocked);
  const catalogue = await listAvatarCatalog(db);
  const byId = new Map(catalogue.map((item) => [item.id, item]));

  const next = { ...state.equipped };

  for (const slot of ["hat", "background", "accessory"] as const) {
    if (body[slot] === undefined) continue;
    const value = body[slot];
    if (value === null) {
      next[slot] = null;
      continue;
    }
    const item = byId.get(value);
    if (!item || item.slot !== slot) {
      throw new EquipAvatarError("ITEM_INVALID");
    }
    if (!unlocked.has(value)) {
      throw new EquipAvatarError("ITEM_LOCKED");
    }
    next[slot] = value;
  }

  await db
    .prepare(
      `UPDATE users
       SET equipped_hat = ?, equipped_background = ?, equipped_accessory = ?
       WHERE family_id = ? AND id = ? AND deleted_at IS NULL`,
    )
    .bind(next.hat, next.background, next.accessory, familyId, memberId)
    .run();

  return {
    ...state,
    equipped: next,
  };
}

export class EquipAvatarError extends Error {
  constructor(readonly code: "ITEM_INVALID" | "ITEM_LOCKED") {
    super(code);
  }
}
