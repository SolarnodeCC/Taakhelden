import { Hono } from "hono";
import type { AppBindings } from "../types";
import { requireParent } from "../middleware/authz";
import { idempotency } from "../middleware/idempotency";
import { callFamilyRoom } from "../services/familyRoom";
import { listRedemptions } from "../repo/rewards";

const redemptions = new Hono<AppBindings>();

/** Openstaande/afgehandelde inlossingen — voor het ouder-dashboard. */
redemptions.get("/", async (c) => {
  const { familyId } = requireParent(c);
  const rows = await listRedemptions(c.env.DB, familyId, {
    status: c.req.query("status"),
    childId: c.req.query("childId"),
  });
  return c.json(
    rows.map((r) => ({
      id: r.id,
      rewardId: r.reward_id,
      title: r.title,
      icon: r.icon,
      price: r.price,
      childId: r.child_id,
      status: r.status,
      createdAt: r.created_at,
      handledAt: r.handled_at ?? null,
    })),
  );
});

redemptions.post("/:id/fulfill", idempotency, async (c) => {
  requireParent(c);
  return callFamilyRoom(c, "/redemption-fulfill", { redemptionId: c.req.param("id") });
});

/** Annuleren → tegenboeking in het ledger (punten terug naar het kind). */
redemptions.post("/:id/cancel", idempotency, async (c) => {
  requireParent(c);
  return callFamilyRoom(c, "/redemption-cancel", { redemptionId: c.req.param("id") });
});

export default redemptions;
