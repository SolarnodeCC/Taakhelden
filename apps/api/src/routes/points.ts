import { Hono } from "hono";
import { AdjustBody, ErrorCodes } from "@taakhelden/shared";
import type { AppBindings } from "../types";
import { ApiException } from "../middleware/error";
import { requireParent } from "../middleware/authz";
import { validate } from "../middleware/validate";
import { idempotency } from "../middleware/idempotency";
import { callFamilyRoom } from "../services/familyRoom";
import { getFamily, getMember, listChildren } from "../repo/families";
import { listEntries } from "../repo/ledger";
import { computeBalance } from "../services/pointsEngine";

const points = new Hono<AppBindings>();

type FamilyRow = { timezone: string; week_bonus_threshold: number };

/** Kind: eigen saldo + voortgang + streak. Ouder: alle kinderen. */
points.get("/balance", async (c) => {
  const { familyId, userId, role } = c.get("auth");
  const family = (await getFamily(c.env.DB, familyId)) as unknown as FamilyRow | null;
  if (!family) {
    throw new ApiException(404, ErrorCodes.NOT_FOUND, "Gezin niet gevonden.");
  }
  if (role === "child") {
    return c.json(await computeBalance(c.env.DB, familyId, family, userId));
  }
  const children = await listChildren(c.env.DB, familyId);
  const balances = await Promise.all(
    children.map((ch) => computeBalance(c.env.DB, familyId, family, ch.id as string)),
  );
  return c.json({ children: balances });
});

/** Paginated grootboek — "waar komen mijn punten vandaan?" Kind: alleen eigen. */
points.get("/ledger", async (c) => {
  const auth = c.get("auth");
  const requested = c.req.query("childId") ?? (auth.role === "child" ? auth.userId : undefined);
  if (!requested) {
    throw new ApiException(400, ErrorCodes.VALIDATION_FAILED, "childId is verplicht.");
  }
  if (auth.role === "child" && requested !== auth.userId) {
    throw new ApiException(403, ErrorCodes.FORBIDDEN, "Dit is niet jouw spaarpot.");
  }
  // familyId-scope: bestaat dit kind wel in dít gezin?
  const child = await getMember(c.env.DB, auth.familyId, requested);
  if (!child || child.role !== "child") {
    throw new ApiException(404, ErrorCodes.NOT_FOUND, "Kindprofiel niet gevonden.");
  }

  const limit = Math.min(Number(c.req.query("limit") ?? 50), 100);
  const rawCursor = c.req.query("cursor");
  const cursor = rawCursor
    ? (JSON.parse(atob(rawCursor)) as { createdAt: string; id: string })
    : undefined;

  const rows = await listEntries(c.env.DB, auth.familyId, requested, { limit, cursor });
  const page = rows.slice(0, limit);
  const last = page[page.length - 1] as Record<string, unknown> | undefined;
  const nextCursor =
    rows.length > limit && last
      ? btoa(JSON.stringify({ createdAt: last.created_at, id: last.id }))
      : null;

  return c.json({
    entries: page.map((r) => ({
      id: r.id,
      type: r.type,
      amount: r.amount,
      ref: r.ref_id ?? null,
      note: r.note ?? null,
      at: r.created_at,
    })),
    nextCursor,
  });
});

/** Handmatige bijboeking mét reden — alleen positief (architectuurregel 4). */
points.post("/adjust", idempotency, validate("json", AdjustBody), async (c) => {
  const { familyId } = requireParent(c, { full: true });
  const body = c.req.valid("json");
  const child = await getMember(c.env.DB, familyId, body.childId);
  if (!child || child.role !== "child") {
    throw new ApiException(404, ErrorCodes.NOT_FOUND, "Kindprofiel niet gevonden.");
  }
  return callFamilyRoom(c, "/adjust", body);
});

export default points;
