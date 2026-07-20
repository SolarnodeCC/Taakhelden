import type { TaskBody, TaskPatchBody } from "@taakhelden/shared";
import { newId } from "../services/ids";

export async function listTasks(db: D1Database, familyId: string) {
  return db
    .prepare("SELECT * FROM tasks WHERE family_id = ? AND archived_at IS NULL ORDER BY created_at")
    .bind(familyId)
    .all();
}

export async function getTask(db: D1Database, familyId: string, taskId: string) {
  return db
    .prepare("SELECT * FROM tasks WHERE family_id = ? AND id = ?")
    .bind(familyId, taskId)
    .first();
}

export async function createTask(db: D1Database, familyId: string, body: TaskBody & { activeFrom?: string }) {
  const id = newId("tsk");
  await db
    .prepare(
      `INSERT INTO tasks (id, family_id, title, category, icon, points, photo_bonus_points,
         approval_required, assignees, rotation, recurrence, daypart, active_from, active_until)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id, familyId, body.title, body.category, body.icon, body.points, body.photoBonusPoints,
      body.approvalRequired ? 1 : 0,
      JSON.stringify(body.assignees),
      body.rotation ? JSON.stringify(body.rotation) : null,
      body.recurrence ? JSON.stringify(body.recurrence) : null,
      body.daypart, body.activeFrom ?? null, body.activeUntil,
    )
    .run();
  return id;
}

const TASK_COLUMNS: Record<string, { column: string; encode?: (v: unknown) => unknown }> = {
  title: { column: "title" },
  category: { column: "category" },
  icon: { column: "icon" },
  points: { column: "points" },
  photoBonusPoints: { column: "photo_bonus_points" },
  approvalRequired: { column: "approval_required", encode: (v) => (v ? 1 : 0) },
  assignees: { column: "assignees", encode: (v) => JSON.stringify(v) },
  rotation: { column: "rotation", encode: (v) => (v == null ? null : JSON.stringify(v)) },
  recurrence: { column: "recurrence", encode: (v) => (v == null ? null : JSON.stringify(v)) },
  daypart: { column: "daypart" },
  activeFrom: { column: "active_from" },
  activeUntil: { column: "active_until" },
};

/** Wijzigingen werken alleen door op toekomstige instances (spec §3.4). */
export async function updateTask(db: D1Database, familyId: string, taskId: string, patch: TaskPatchBody) {
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const [key, { column, encode }] of Object.entries(TASK_COLUMNS)) {
    const value = (patch as Record<string, unknown>)[key];
    if (value === undefined) continue;
    sets.push(`${column} = ?`);
    values.push(encode ? encode(value) : value);
  }
  if (sets.length === 0) return;
  await db
    .prepare(`UPDATE tasks SET ${sets.join(", ")} WHERE family_id = ? AND id = ? AND archived_at IS NULL`)
    .bind(...values, familyId, taskId)
    .run();
}

/** Archiveren, geen harde delete: historie en ledger blijven intact. */
export async function archiveTask(db: D1Database, familyId: string, taskId: string) {
  await db
    .prepare("UPDATE tasks SET archived_at = datetime('now') WHERE family_id = ? AND id = ?")
    .bind(familyId, taskId)
    .run();
}

export async function listActiveTasksForDate(db: D1Database, familyId: string, date: string) {
  const { results } = await db
    .prepare(
      `SELECT * FROM tasks
       WHERE family_id = ? AND archived_at IS NULL
         AND (active_from IS NULL OR active_from <= ?)
         AND (active_until IS NULL OR active_until >= ?)`,
    )
    .bind(familyId, date, date)
    .all();
  return results;
}
