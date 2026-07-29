/**
 * Coöperatieve gezinsdoelen. Progress = som positieve ledger sinds started_at —
 * nooit huidig saldo, nooit per-kind ranking in de response voor kind-UI.
 */
import type { CreateFamilyGoalBody, FamilyGoal, FamilyGoalProgress, PatchFamilyGoalBody } from "@taakhelden/shared";
import { z } from "zod";
import { newId } from "../services/ids";
import { parseJsonColumn } from "../services/jsonParse";
import { listChildren } from "./families";

const ChildIdList = z.array(z.string().min(1));

interface FamilyGoalRow {
  id: string;
  family_id: string;
  title: string;
  icon: string;
  target_points: number;
  child_ids_json: string | null;
  started_at: string;
  completed_at: string | null;
  status: "active" | "completed" | "archived";
}

function parseChildIds(raw: string | null): string[] {
  return parseJsonColumn(raw, ChildIdList, []);
}

function mapGoal(row: FamilyGoalRow): FamilyGoal {
  return {
    id: row.id,
    title: row.title,
    icon: row.icon,
    targetPoints: row.target_points,
    childIds: parseChildIds(row.child_ids_json),
    startedAt: row.started_at,
    completedAt: row.completed_at,
    status: row.status,
  };
}

export async function listFamilyGoals(db: D1Database, familyId: string): Promise<FamilyGoal[]> {
  const { results } = await db
    .prepare(
      `SELECT id, family_id, title, icon, target_points, child_ids_json, started_at, completed_at, status
       FROM family_goals
       WHERE family_id = ? AND status != 'archived'
       ORDER BY created_at DESC`,
    )
    .bind(familyId)
    .all<FamilyGoalRow>();
  return results.map(mapGoal);
}

export async function getActiveFamilyGoal(
  db: D1Database,
  familyId: string,
): Promise<FamilyGoal | null> {
  const row = await db
    .prepare(
      `SELECT id, family_id, title, icon, target_points, child_ids_json, started_at, completed_at, status
       FROM family_goals
       WHERE family_id = ? AND status = 'active'
       ORDER BY created_at DESC
       LIMIT 1`,
    )
    .bind(familyId)
    .first<FamilyGoalRow>();
  return row ? mapGoal(row) : null;
}

export async function getFamilyGoal(
  db: D1Database,
  familyId: string,
  goalId: string,
): Promise<FamilyGoal | null> {
  const row = await db
    .prepare(
      `SELECT id, family_id, title, icon, target_points, child_ids_json, started_at, completed_at, status
       FROM family_goals WHERE family_id = ? AND id = ?`,
    )
    .bind(familyId, goalId)
    .first<FamilyGoalRow>();
  return row ? mapGoal(row) : null;
}

export async function createFamilyGoal(
  db: D1Database,
  familyId: string,
  body: CreateFamilyGoalBody,
): Promise<FamilyGoal> {
  const existing = await getActiveFamilyGoal(db, familyId);
  if (existing) {
    throw new FamilyGoalError("ACTIVE_EXISTS");
  }

  if (body.childIds.length > 0) {
    const children = await listChildren(db, familyId);
    const allowed = new Set(children.map((c) => c.id as string));
    for (const id of body.childIds) {
      if (!allowed.has(id)) throw new FamilyGoalError("CHILD_INVALID");
    }
  }

  const id = newId("fgoal");
  const startedAt = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO family_goals
         (id, family_id, title, icon, target_points, child_ids_json, started_at, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`,
    )
    .bind(
      id,
      familyId,
      body.title,
      body.icon,
      body.targetPoints,
      body.childIds.length ? JSON.stringify(body.childIds) : null,
      startedAt,
    )
    .run();

  return {
    id,
    title: body.title,
    icon: body.icon,
    targetPoints: body.targetPoints,
    childIds: body.childIds,
    startedAt,
    completedAt: null,
    status: "active",
  };
}

export async function patchFamilyGoal(
  db: D1Database,
  familyId: string,
  goalId: string,
  body: PatchFamilyGoalBody,
): Promise<FamilyGoal | null> {
  const current = await getFamilyGoal(db, familyId, goalId);
  if (!current) return null;

  const title = body.title ?? current.title;
  const icon = body.icon ?? current.icon;
  let status = current.status;
  let completedAt = current.completedAt;

  if (body.status === "archived") {
    status = "archived";
  } else if (body.status === "completed") {
    status = "completed";
    completedAt = completedAt ?? new Date().toISOString();
  }

  await db
    .prepare(
      `UPDATE family_goals
       SET title = ?, icon = ?, status = ?, completed_at = ?
       WHERE family_id = ? AND id = ?`,
    )
    .bind(title, icon, status, completedAt, familyId, goalId)
    .run();

  return {
    ...current,
    title,
    icon,
    status,
    completedAt,
  };
}

/**
 * Som van positieve ledger-entries sinds goal.startedAt voor de doelgroep.
 * Ledger `created_at` is SQLite datetime; startedAt is ISO — we normaliseren
 * via strftime epoch-vergelijking.
 */
export async function computeGoalProgress(
  db: D1Database,
  familyId: string,
  goal: FamilyGoal,
): Promise<FamilyGoalProgress> {
  let childIds = goal.childIds;
  if (childIds.length === 0) {
    const children = await listChildren(db, familyId);
    childIds = children.map((c) => c.id as string);
  }

  let earnedPoints = 0;
  if (childIds.length > 0) {
    const placeholders = childIds.map(() => "?").join(",");
    const row = await db
      .prepare(
        `SELECT COALESCE(SUM(amount), 0) AS earned
         FROM points_ledger
         WHERE family_id = ?
           AND child_id IN (${placeholders})
           AND amount > 0
           AND type != 'redemption_cancel'
           AND strftime('%s', created_at) >= strftime('%s', ?)`,
      )
      .bind(familyId, ...childIds, goal.startedAt)
      .first<{ earned: number }>();
    earnedPoints = row?.earned ?? 0;
  }

  return {
    goalId: goal.id,
    title: goal.title,
    icon: goal.icon,
    earnedPoints,
    targetPoints: goal.targetPoints,
    status: goal.status,
  };
}

/**
 * Atomic complete when earned ≥ target. Safe under concurrent callers
 * (`WHERE status = 'active'`). Intended for ledger-write paths (FamilyRoom),
 * not for GET handlers — keeps progress reads side-effect free.
 */
export async function completeActiveGoalIfReached(
  db: D1Database,
  familyId: string,
): Promise<boolean> {
  const goal = await getActiveFamilyGoal(db, familyId);
  if (!goal) return false;
  const progress = await computeGoalProgress(db, familyId, goal);
  if (progress.earnedPoints < progress.targetPoints) return false;
  const completedAt = new Date().toISOString();
  const result = await db
    .prepare(
      `UPDATE family_goals
       SET status = 'completed', completed_at = ?
       WHERE family_id = ? AND id = ? AND status = 'active'`,
    )
    .bind(completedAt, familyId, goal.id)
    .run();
  return (result.meta.changes ?? 0) > 0;
}

export class FamilyGoalError extends Error {
  constructor(readonly code: "ACTIVE_EXISTS" | "CHILD_INVALID") {
    super(code);
  }
}
