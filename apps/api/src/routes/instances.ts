import { Hono } from "hono";
import {
  RedoBody,
  AttachPhotoBody,
  ChildTodayView,
  ErrorCodes,
  HistoryCursor,
  ParentTodayView,
  TodayViewerResponse,
} from "@taakhelden/shared";
import type { AppBindings } from "../types";
import { ApiException } from "../middleware/error";
import { requireParent } from "../middleware/authz";
import { validate } from "../middleware/validate";
import { idempotency, requireIdempotencyKey } from "../middleware/idempotency";
import { callFamilyRoom } from "../services/familyRoom";
import { getFamily, listChildren } from "../repo/families";
import { listForDate, listHistory } from "../repo/instances";
import { isContractV2 } from "../services/contract";
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
    photoId: row.photo_id ?? null,
    photoStatus: row.photo_status ?? null,
    pointsEarned: row.points_earned ?? null,
    redoNote: row.redo_note ?? null,
    completedAt: row.completed_at ?? null,
    approvedAt: row.approved_at ?? null,
  };
}

type FamilyRow = { timezone: string; week_bonus_threshold: number };

/**
 * Decodeert de opaque base64-cursor uit de query. Een kapotte of geknoeide
 * cursor is een cliëntfout (400), geen 500 — atob/JSON.parse mogen nooit
 * ongevangen falen, en het resultaat wordt pas als HistoryCursor vertrouwd
 * nadat de vorm geverifieerd is (geen blinde `as`-cast op clientinvoer).
 */
function decodeHistoryCursor(raw?: string): HistoryCursor | undefined {
  if (!raw) return undefined;
  let json: unknown;
  try {
    json = JSON.parse(atob(raw));
  } catch {
    throw new ApiException(400, ErrorCodes.VALIDATION_FAILED, "Ongeldige cursor.");
  }
  const parsed = HistoryCursor.safeParse(json);
  if (!parsed.success) {
    throw new ApiException(400, ErrorCodes.VALIDATION_FAILED, "Ongeldige cursor.");
  }
  return parsed.data;
}

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
    const response = {
      date: today,
      instances: rows.map((r) => instanceView(r as Record<string, unknown>)),
      balance,
    };
    if (isContractV2(c)) {
      return c.json(TodayViewerResponse.parse({ viewer: "child", ...response }));
    }
    return c.json(ChildTodayView.parse(response));
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
  const response = { date: today, children: byChild };
  if (isContractV2(c)) {
    return c.json(TodayViewerResponse.parse({ viewer: "parent", ...response }));
  }
  return c.json(ParentTodayView.parse(response));
});

/** Historie (paginated) — alleen ouders. */
instances.get("/", async (c) => {
  const { familyId } = requireParent(c);
  const limit = Math.min(Number(c.req.query("limit") ?? 50), 100);
  const cursor = decodeHistoryCursor(c.req.query("cursor"));

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

/** Foto-bonus koppelen (kind, eigen taak) — na de presigned-flow uit §3.6. */
instances.post("/:id/photo", idempotency, validate("json", AttachPhotoBody), async (c) => {
  const { role } = c.get("auth");
  if (role !== "child") {
    // Rollenmatrix §5: alleen het kind zelf koppelt taakfoto's.
    throw new ApiException(403, ErrorCodes.FORBIDDEN, "Alleen kinderen koppelen taakfoto's.");
  }
  return callFamilyRoom(c, "/attach-photo", {
    instanceId: c.req.param("id"),
    photoId: c.req.valid("json").photoId,
  });
});

export default instances;
