export interface InstanceRow {
  id: string;
  task_id: string;
  family_id: string;
  child_id: string;
  date: string;
  status: "open" | "completed" | "submitted" | "open_redo" | "approved";
  photo_key: string | null;
  photo_status: string | null;
  points_earned: number | null;
  redo_note: string | null;
  completed_at: string | null;
  approved_at: string | null;
  approved_by: string | null;
}

export async function getInstance(db: D1Database, familyId: string, instanceId: string) {
  return db
    .prepare("SELECT * FROM task_instances WHERE family_id = ? AND id = ?")
    .bind(familyId, instanceId)
    .first<InstanceRow>();
}

/** Instances van één dag, met taakinfo erbij (titel/punten/daypart voor de UI). */
export async function listForDate(db: D1Database, familyId: string, date: string, childId?: string) {
  const base = `
    SELECT i.*, t.title, t.icon, t.category, t.points AS task_points,
           t.photo_bonus_points, t.approval_required, t.daypart,
           (SELECT p.id FROM photos p
              WHERE p.family_id = i.family_id AND p.ref_id = i.id
                AND p.purpose = 'task' AND p.status = 'ready'
              ORDER BY p.created_at DESC LIMIT 1) AS photo_id
    FROM task_instances i JOIN tasks t ON t.id = i.task_id
    WHERE i.family_id = ? AND i.date = ?`;
  const stmt = childId
    ? db.prepare(`${base} AND i.child_id = ? ORDER BY t.daypart, t.created_at`).bind(familyId, date, childId)
    : db.prepare(`${base} ORDER BY i.child_id, t.daypart, t.created_at`).bind(familyId, date);
  const { results } = await stmt.all();
  return results;
}

/** Paginated historie (cursor = created-volgorde op date+id, aflopend). */
export async function listHistory(
  db: D1Database,
  familyId: string,
  opts: { childId?: string; from?: string; to?: string; limit: number; cursor?: { date: string; id: string } },
) {
  const conditions = ["i.family_id = ?"];
  const values: unknown[] = [familyId];
  if (opts.childId) { conditions.push("i.child_id = ?"); values.push(opts.childId); }
  if (opts.from) { conditions.push("i.date >= ?"); values.push(opts.from); }
  if (opts.to) { conditions.push("i.date <= ?"); values.push(opts.to); }
  if (opts.cursor) {
    conditions.push("(i.date < ? OR (i.date = ? AND i.id < ?))");
    values.push(opts.cursor.date, opts.cursor.date, opts.cursor.id);
  }
  const { results } = await db
    .prepare(
      `SELECT i.*, t.title, t.icon, t.points AS task_points
       FROM task_instances i JOIN tasks t ON t.id = i.task_id
       WHERE ${conditions.join(" AND ")}
       ORDER BY i.date DESC, i.id DESC LIMIT ?`,
    )
    .bind(...values, opts.limit + 1)
    .all();
  return results;
}

export async function insertInstance(
  db: D1Database,
  familyId: string,
  input: { id: string; taskId: string; childId: string; date: string },
) {
  // OR IGNORE + UNIQUE(task_id, child_id, date): generatie is idempotent.
  await db
    .prepare(
      `INSERT OR IGNORE INTO task_instances (id, task_id, family_id, child_id, date)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(input.id, input.taskId, familyId, input.childId, input.date)
    .run();
}

export async function setStatus(
  db: D1Database,
  familyId: string,
  instanceId: string,
  fields: {
    status: InstanceRow["status"];
    pointsEarned?: number | null;
    redoNote?: string | null;
    completedAt?: string | null;
    approvedAt?: string | null;
    approvedBy?: string | null;
  },
) {
  await db
    .prepare(
      `UPDATE task_instances SET
         status = ?,
         points_earned = COALESCE(?, points_earned),
         redo_note = ?,
         completed_at = COALESCE(?, completed_at),
         approved_at = COALESCE(?, approved_at),
         approved_by = COALESCE(?, approved_by)
       WHERE family_id = ? AND id = ?`,
    )
    .bind(
      fields.status,
      fields.pointsEarned ?? null,
      fields.redoNote ?? null,
      fields.completedAt ?? null,
      fields.approvedAt ?? null,
      fields.approvedBy ?? null,
      familyId,
      instanceId,
    )
    .run();
}

/** Foto koppelen aan een instance (foto-bonusflow §3.6). */
export async function setPhoto(
  db: D1Database,
  familyId: string,
  instanceId: string,
  fields: { photoKey: string; photoStatus: "processing" | "ready" },
) {
  await db
    .prepare("UPDATE task_instances SET photo_key = ?, photo_status = ? WHERE family_id = ? AND id = ?")
    .bind(fields.photoKey, fields.photoStatus, familyId, instanceId)
    .run();
}

/** Terug naar open (oeps-knop): wist afvink-metadata expliciet. */
export async function reopenInstance(db: D1Database, familyId: string, instanceId: string) {
  await db
    .prepare(
      `UPDATE task_instances
       SET status = 'open', completed_at = NULL, points_earned = NULL, redo_note = NULL
       WHERE family_id = ? AND id = ?`,
    )
    .bind(familyId, instanceId)
    .run();
}

/** Open taken van een dag (voor de herinnerings-scheduler), oudste taak eerst. */
export async function listOpenForDate(db: D1Database, familyId: string, date: string) {
  const { results } = await db
    .prepare(
      `SELECT i.child_id, t.title, t.points
       FROM task_instances i JOIN tasks t ON t.id = i.task_id
       WHERE i.family_id = ? AND i.date = ? AND i.status IN ('open', 'open_redo')
       ORDER BY i.child_id, t.created_at`,
    )
    .bind(familyId, date)
    .all<{ child_id: string; title: string; points: number }>();
  return results;
}

export async function dayStats(db: D1Database, familyId: string, childId: string, date: string) {
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved
       FROM task_instances WHERE family_id = ? AND child_id = ? AND date = ?`,
    )
    .bind(familyId, childId, date)
    .first<{ total: number; approved: number }>();
  return { total: row?.total ?? 0, approved: row?.approved ?? 0 };
}

export async function weekStats(db: D1Database, familyId: string, childId: string, dates: string[]) {
  const placeholders = dates.map(() => "?").join(",");
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved
       FROM task_instances WHERE family_id = ? AND child_id = ? AND date IN (${placeholders})`,
    )
    .bind(familyId, childId, ...dates)
    .first<{ total: number; approved: number }>();
  return { total: row?.total ?? 0, approved: row?.approved ?? 0 };
}
