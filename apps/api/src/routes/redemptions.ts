import { Hono } from "hono";
import { z } from "zod";
import { RedemptionsViewerResponse, RedemptionView } from "@taakhelden/shared";
import type { AppBindings } from "../types";
import { ApiException } from "../middleware/error";
import { ErrorCodes } from "@taakhelden/shared";
import { requireParent } from "../middleware/authz";
import { idempotency, requireIdempotencyKey } from "../middleware/idempotency";
import { isContractV2 } from "../services/contract";
import { callFamilyRoom } from "../services/familyRoom";
import { listRedemptions } from "../repo/rewards";

const redemptions = new Hono<AppBindings>();
const LegacyRedemptionList = z.array(RedemptionView);

/** Openstaande/afgehandelde inlossingen — ouder ziet het gezin, kind alleen zichzelf. */
redemptions.get("/", async (c) => {
  const { familyId, role, userId } = c.get("auth");
  const requestedChildId = c.req.query("childId");
  if (role === "child" && requestedChildId && requestedChildId !== userId) {
    throw new ApiException(403, ErrorCodes.FORBIDDEN, "Dit is niet van jou.");
  }
  if (role === "parent") {
    requireParent(c);
  }
  const rows = await listRedemptions(c.env.DB, familyId, {
    status: c.req.query("status"),
    childId: role === "child" ? userId : requestedChildId,
  });
  const response = rows.map((r) => ({
    id: r.id,
    rewardId: r.reward_id,
    title: r.title,
    icon: (r.icon as string | null) ?? null,
    price: r.price,
    childId: r.child_id,
    status: r.status,
    createdAt: r.created_at,
    handledAt: r.handled_at ?? null,
  }));
  if (isContractV2(c)) {
    return c.json(
      RedemptionsViewerResponse.parse({
        viewer: role,
        redemptions: response,
      }),
    );
  }
  return c.json(LegacyRedemptionList.parse(response));
});

redemptions.post("/:id/fulfill", requireIdempotencyKey, idempotency, async (c) => {
  requireParent(c);
  return callFamilyRoom(c, "/redemption-fulfill", { redemptionId: c.req.param("id") });
});

/** Annuleren → tegenboeking in het ledger (punten terug naar het kind). */
redemptions.post("/:id/cancel", requireIdempotencyKey, idempotency, async (c) => {
  requireParent(c);
  return callFamilyRoom(c, "/redemption-cancel", { redemptionId: c.req.param("id") });
});

export default redemptions;
