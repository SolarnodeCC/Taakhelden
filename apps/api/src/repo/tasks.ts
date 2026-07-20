import type { TaskBody } from "@taakhelden/shared";
import { newId } from "../services/ids";

export async function listTasks(db: D1Database, familyId: string) {
  return db
    .prepare("SELECT * FROM tasks WHERE family_id = ? AND archived_at IS NULL ORDER BY created_at")
    .bind(familyId)
    .all();
}

export async function createTask(db: D1Database, familyId: string, body: TaskBody) {
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
