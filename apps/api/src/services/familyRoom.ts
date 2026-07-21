import type { Context } from "hono";
import type { AppBindings } from "../types";
import type { Actor } from "./pointsEngine";

/**
 * Stuurt een mutatie naar de FamilyRoom-DO van het gezin en geeft de
 * DO-response 1-op-1 door (zelfde foutmodel, zelfde statuscode).
 */
export async function callFamilyRoom(
  c: Context<AppBindings>,
  path:
    | "/complete"
    | "/approve"
    | "/redo"
    | "/undo"
    | "/adjust"
    | "/redeem"
    | "/redemption-fulfill"
    | "/redemption-cancel"
    | "/attach-photo",
  payload: {
    instanceId?: string;
    note?: string;
    childId?: string;
    amount?: number;
    rewardId?: string;
    redemptionId?: string;
    photoId?: string;
  },
): Promise<Response> {
  const { familyId, userId, role } = c.get("auth");
  const actor: Actor = { userId, role };
  // De Idempotency-Key gaat mee de DO in, zodat dedup binnen de geserialiseerde
  // mutatie-turn gebeurt — de KV-cache alleen dekt de race van twee gelijktijdige
  // requests niet af (die schrijven pas ná afloop, dus missen allebei de cache).
  const idempotencyKey = c.req.header("Idempotency-Key") ?? undefined;
  const stub = c.env.FAMILY_DO.get(c.env.FAMILY_DO.idFromName(familyId));
  const res = await stub.fetch(`https://family-room.internal${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ familyId, actor, idempotencyKey, ...payload }),
  });
  return c.newResponse(await res.text(), res.status as 200, {
    "Content-Type": "application/json",
  });
}
