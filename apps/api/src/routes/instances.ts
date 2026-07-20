import { Hono } from "hono";
import { RedoBody, ErrorCodes } from "@taakhelden/shared";
import type { AppBindings } from "../types";
import { ApiException } from "../middleware/error";
import { requireParent } from "../middleware/authz";
import { validate } from "../middleware/validate";
import { idempotency, requireIdempotencyKey } from "../middleware/idempotency";
import { callFamilyRoom } from "../services/familyRoom";
import { getFamily, listChildren } from "../repo/families";
import { listForDate, listHistory } from "../repo/instances";
import { computeBalance } from "../services/pointsEngine";
import { localDate } from "../services/time";

const instances = new Hono<AppBindings>();

function instanceView(row: Record<string, unknown>) {
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
    pointsEarned: row.points_earned ?? null,
    redoNote: row.redo_note ?? null,
    completedAt: row.completed_at ?? null,
    approvedAt: row.approved_at ?? null,
  };
}

type FamilyRow = { timezone: string; week_bonus_threshold: number };

/** Kind: eigen dag + puntenstatus. Ouder: alle kinderen gegroepeerd. */
instances.get("/today", async (c) => {
  const { familyId, userId, role } = c.get("auth");
  const family = (await getFamily(c.env.DB, familyId)) as unknown as FamilyRow | null;
  if (!family) {
    throw new ApiException(404, ErrorCodes.NOT_FOUND, "Gezin niet gevonden.");
  }
  const today = localDate(family.timezone);

  if (role === "child") {
    const rows = await listForDate(c.env.DB, familyId, today, userId);
    const balance = await computeBalance(c.env.DB, familyId, family, userId);
    return c.json({
      date: today,
      instances: rows.map((r) => instanceView(r as Record<string, unknown>)),
      balance,
    });
  }

  const children = await listChildren(c.env.DB, familyId);
  const rows = await listForDate(c.env.DB, familyId, today);
  const byChild = await Promise.all(
    children.map(async (child) => ({
      childId: child.id,
      displayName: child.display_name,
      avatarId: child.avatar_id ?? null,
      instances: rows
        .filter((r) => r.child_id === child.id)
        .map((r) => instanceView(r as Record<string, unknown>)),
      balance: await computeBalance(c.env.DB, familyId, family, child.id as string),
    })),
  );
  return c.json({ date: today, children: byChild });
});

/** Historie (paginated) — alleen ouders. */
instances.get("/", async (c) => {
  const { familyId } = requireParent(c);
  const limit = Math.min(Number(c.req.query("limit") ?? 50), 100);
  const rawCursor = c.req.query("cursor");
  const cursor = rawCursor
    ? (JSON.parse(atob(rawCursor)) as { date: string; id: string })
    : undefined;

  const rows = await listHistory(c.env.DB, familyId, {
    childId: c.req.query("childId"),
    from: c.req.query("from"),
    to: c.req.query("to"),
    limit,
    cursor,
  });

  const page = rows.slice(0, limit);
  const last = page[page.length - 1] as Record<string, unknown> | undefined;
  const nextCursor =
    rows.length > limit && last ? btoa(JSON.stringify({ date: last.date, id: last.id })) : null;
  return c.json({
    instances: page.map((r) => instanceView(r as Record<string, unknown>)),
    nextCursor,
  });
});

// Alle mutaties lopen via de FamilyRoom-DO (ledger-serialisatie per gezin).
instances.post("/:id/complete", requireIdempotencyKey, idempotency, async (c) =>
  callFamilyRoom(c, "/complete", { instanceId: c.req.param("id") }),
);

instances.post("/:id/approve", idempotency, async (c) => {
  requireParent(c);
  return callFamilyRoom(c, "/approve", { instanceId: c.req.param("id") });
});

instances.post("/:id/redo", validate("json", RedoBody), async (c) => {
  requireParent(c);
  // Vriendelijke toelichting verplicht; GEEN puntenaftrek (architectuurregel 4).
  return callFamilyRoom(c, "/redo", {
    instanceId: c.req.param("id"),
    note: c.req.valid("json").note,
  });
});

instances.post("/:id/undo", async (c) =>
  callFamilyRoom(c, "/undo", { instanceId: c.req.param("id") }),
);

// TODO(iteratie 2): POST /:id/photo — foto-bonus na presigned upload (§3.6).
instances.post("/:id/photo", async (c) => c.json({ todo: "foto-bonus koppelen" }, 501));

export default instances;
