/**
 * GET /badges (API-spec §3.9) — hele catalogus met verdien-status per kind.
 * Kind ziet alleen zijn eigen badges; ouder geeft `?childId=` mee.
 * Toekenning zelf gebeurt server-side bij complete/bonus (pointsEngine).
 */
import { Hono } from "hono";
import { ErrorCodes, type BadgesResponse } from "@taakhelden/shared";
import type { AppBindings } from "../types";
import { ApiException } from "../middleware/error";
import { getMember } from "../repo/families";
import { listCatalogue, listEarned } from "../repo/badges";

const badges = new Hono<AppBindings>();

badges.get("/", async (c) => {
  const auth = c.get("auth");
  const queried = c.req.query("childId");
  if (auth.role === "child" && queried && queried !== auth.userId) {
    throw new ApiException(403, ErrorCodes.FORBIDDEN, "Dit zijn niet jouw badges.");
  }
  const childId = auth.role === "child" ? auth.userId : queried;
  if (!childId) {
    throw new ApiException(400, ErrorCodes.VALIDATION_FAILED, "childId is verplicht.");
  }

  // familyId-scope: bestaat dit kind wel in dít gezin?
  const child = await getMember(c.env.DB, auth.familyId, childId);
  if (!child || child.role !== "child") {
    throw new ApiException(404, ErrorCodes.NOT_FOUND, "Kindprofiel niet gevonden.");
  }

  const [catalogue, earned] = await Promise.all([
    listCatalogue(c.env.DB),
    listEarned(c.env.DB, auth.familyId, childId),
  ]);
  const earnedAt = new Map(earned.map((e) => [e.badgeId, e.earnedAt]));

  const body: BadgesResponse = {
    childId,
    badges: catalogue.map((b) => ({
      id: b.id,
      title: b.title,
      description: b.description,
      icon: b.icon,
      earned: earnedAt.has(b.id),
      earnedAt: earnedAt.get(b.id) ?? null,
    })),
  };
  return c.json(body);
});

export default badges;
