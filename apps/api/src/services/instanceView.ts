import { InstanceView } from "@taakhelden/shared";

/**
 * Repo-rij (task_instances joined met tasks, zie `INSTANCE_WITH_TASK`) →
 * InstanceView-vorm. Eén plek, zodat /instances/today, de historie, de
 * move-response en de sync-delta exact hetzelfde contract teruggeven.
 */
export function toInstanceView(row: Record<string, unknown>) {
  return {
    id: row.id,
    taskId: row.task_id,
    childId: row.child_id,
    date: row.date,
    status: row.status,
    title: row.title,
    icon: row.icon,
    category: row.category,
    points: row.task_points,
    photoBonusPoints: row.photo_bonus_points,
    approvalRequired: Boolean(row.approval_required),
    daypart: row.daypart ?? null,
    photoId: row.photo_id ?? null,
    photoStatus: row.photo_status ?? null,
    pointsEarned: row.points_earned ?? null,
    redoNote: row.redo_note ?? null,
    completedAt: row.completed_at ?? null,
    approvedAt: row.approved_at ?? null,
    updatedAt: (row.updated_at as string | null | undefined) ?? undefined,
  };
}

/** Zelfde mapping, maar gevalideerd tegen het gedeelde contract. */
export function parseInstanceView(row: Record<string, unknown>): InstanceView {
  return InstanceView.parse(toInstanceView(row));
}
