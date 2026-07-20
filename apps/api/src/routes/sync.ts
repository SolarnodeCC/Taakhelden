import { Hono } from "hono";
import { SyncBody } from "@taakhelden/shared";
import type { AppBindings } from "../types";
import { validate } from "../middleware/validate";
import type { Actor } from "../services/pointsEngine";

const sync = new Hono<AppBindings>();

/**
 * Batch-sync (§3.11). De hele batch gaat als één interne POST naar de
 * FamilyRoom-DO, die mutaties strikt op volgorde en per gezin geserialiseerd
 * verwerkt. Idempotentie zit per client-`key` in de DO (KV) — de app mag dus
 * gerust dezelfde batch opnieuw sturen na een netwerkfout.
 */
sync.post("/", validate("json", SyncBody), async (c) => {
  const { familyId, userId, role } = c.get("auth");
  const actor: Actor = { userId, role };
  const body = c.req.valid("json");

  const stub = c.env.FAMILY_DO.get(c.env.FAMILY_DO.idFromName(familyId));
  const res = await stub.fetch("https://family-room.internal/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ familyId, actor, mutations: body.mutations, since: body.since }),
  });
  return c.newResponse(await res.text(), res.status as 200, {
    "Content-Type": "application/json",
  });
});

export default sync;
