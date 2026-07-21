export interface RewardRow {
  id: string;
  family_id: string;
  title: string;
  icon: string;
  price: number;
  limit_per_week: number | null;
  archived_at: string | null;
  created_at: string;
}

export interface RedemptionRow {
  id: string;
  family_id: string;
  reward_id: string;
  child_id: string;
  status: "pending" | "fulfilled" | "cancelled";
  created_at: string;
  handled_at: string | null;
  handled_by: string | null;
  // uit de JOIN met rewards:
  price: number;
  title: string;
}

export async function listRewards(
  db: D1Database,
  familyId: string,
  opts: { includeArchived?: boolean } = {},
) {
  const archivedClause = opts.includeArchived ? "" : "AND archived_at IS NULL";
  const { results } = await db
    .prepare(`SELECT * FROM rewards WHERE family_id = ? ${archivedClause} ORDER BY price, created_at`)
    .bind(familyId)
    .all<RewardRow>();
  return results;
}

export async function getReward(db: D1Database, familyId: string, rewardId: string) {
  return db
    .prepare("SELECT * FROM rewards WHERE family_id = ? AND id = ?")
    .bind(familyId, rewardId)
    .first<RewardRow>();
}

export async function insertReward(
  db: D1Database,
  familyId: string,
  input: { id: string; title: string; icon: string; price: number; limitPerWeek: number | null },
) {
  await db
    .prepare(
      "INSERT INTO rewards (id, family_id, title, icon, price, limit_per_week) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(input.id, familyId, input.title, input.icon, input.price, input.limitPerWeek)
    .run();
}

export async function updateReward(
  db: D1Database,
  familyId: string,
  rewardId: string,
  patch: { title?: string; icon?: string; price?: number; limitPerWeek?: number | null },
) {
  const sets: string[] = [];
  const values: unknown[] = [];
  if (patch.title !== undefined) { sets.push("title = ?"); values.push(patch.title); }
  if (patch.icon !== undefined) { sets.push("icon = ?"); values.push(patch.icon); }
  if (patch.price !== undefined) { sets.push("price = ?"); values.push(patch.price); }
  if (patch.limitPerWeek !== undefined) { sets.push("limit_per_week = ?"); values.push(patch.limitPerWeek); }
  if (sets.length === 0) return;
  await db
    .prepare(`UPDATE rewards SET ${sets.join(", ")} WHERE family_id = ? AND id = ? AND archived_at IS NULL`)
    .bind(...values, familyId, rewardId)
    .run();
}

/** Archiveren i.p.v. verwijderen: historie en ledger-referenties blijven intact. */
export async function archiveReward(db: D1Database, familyId: string, rewardId: string) {
  await db
    .prepare("UPDATE rewards SET archived_at = datetime('now') WHERE family_id = ? AND id = ?")
    .bind(familyId, rewardId)
    .run();
}

// --- redemptions ---

export async function insertRedemption(
  db: D1Database,
  familyId: string,
  input: { id: string; rewardId: string; childId: string },
) {
  await db
    .prepare(
      "INSERT INTO redemptions (id, family_id, reward_id, child_id) VALUES (?, ?, ?, ?)",
    )
    .bind(input.id, familyId, input.rewardId, input.childId)
    .run();
}

export async function getRedemption(db: D1Database, familyId: string, redemptionId: string) {
  return db
    .prepare(
      `SELECT rd.*, rw.price, rw.title
       FROM redemptions rd JOIN rewards rw ON rw.id = rd.reward_id
       WHERE rd.family_id = ? AND rd.id = ?`,
    )
    .bind(familyId, redemptionId)
    .first<RedemptionRow>();
}

export async function setRedemptionStatus(
  db: D1Database,
  familyId: string,
  redemptionId: string,
  fields: { status: "fulfilled" | "cancelled"; handledBy: string },
) {
  await db
    .prepare(
      `UPDATE redemptions SET status = ?, handled_at = datetime('now'), handled_by = ?
       WHERE family_id = ? AND id = ?`,
    )
    .bind(fields.status, fields.handledBy, familyId, redemptionId)
    .run();
}

export async function listRedemptions(
  db: D1Database,
  familyId: string,
  opts: { status?: string; childId?: string } = {},
) {
  const conditions = ["rd.family_id = ?"];
  const values: unknown[] = [familyId];
  if (opts.status) { conditions.push("rd.status = ?"); values.push(opts.status); }
  if (opts.childId) { conditions.push("rd.child_id = ?"); values.push(opts.childId); }
  const { results } = await db
    .prepare(
      `SELECT rd.*, rw.price, rw.title, rw.icon
       FROM redemptions rd JOIN rewards rw ON rw.id = rd.reward_id
       WHERE ${conditions.join(" AND ")} ORDER BY rd.created_at DESC LIMIT 100`,
    )
    .bind(...values)
    .all();
  return results;
}

/**
 * Aantal niet-geannuleerde inlossingen van dit kind voor deze beloning sinds
 * `sinceUtc`. `created_at` staat in UTC, dus de aanroeper geeft de gezins-lokale
 * weekgrens al omgerekend naar UTC mee (zie `localMidnightUtc`) — anders zou het
 * venster met de tijdzone-offset verschuiven.
 */
export async function countRedemptionsSince(
  db: D1Database,
  familyId: string,
  childId: string,
  rewardId: string,
  sinceUtc: string,
) {
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM redemptions
       WHERE family_id = ? AND child_id = ? AND reward_id = ? AND status != 'cancelled'
         AND created_at >= ?`,
    )
    .bind(familyId, childId, rewardId, sinceUtc)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

// --- spaardoel (max 1 per kind) ---

/** Scoping loopt via users: pinned_rewards heeft zelf geen family_id-kolom. */
export async function getPinnedReward(db: D1Database, familyId: string, childId: string) {
  return db
    .prepare(
      `SELECT p.reward_id, rw.title, rw.icon, rw.price, rw.archived_at
       FROM pinned_rewards p
       JOIN users u ON u.id = p.child_id AND u.family_id = ?
       JOIN rewards rw ON rw.id = p.reward_id
       WHERE p.child_id = ?`,
    )
    .bind(familyId, childId)
    .first<{ reward_id: string; title: string; icon: string; price: number; archived_at: string | null }>();
}

export async function setPinnedReward(db: D1Database, familyId: string, childId: string, rewardId: string) {
  // Kind- en beloning-membership zijn door de aanroeper al binnen familyId gecheckt.
  await db
    .prepare(
      `INSERT INTO pinned_rewards (child_id, reward_id) VALUES (?, ?)
       ON CONFLICT (child_id) DO UPDATE SET reward_id = excluded.reward_id, pinned_at = datetime('now')`,
    )
    .bind(childId, rewardId)
    .run();
}
