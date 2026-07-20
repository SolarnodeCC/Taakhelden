import type { Context } from "hono";
import type { AppBindings } from "../types";
import type { Actor } from "./pointsEngine";

/**
 * Stuurt een mutatie naar de FamilyRoom-DO van het gezin en geeft de
 * DO-response 1-op-1 door (zelfde foutmodel, zelfde statuscode).
 */
export async function callFamilyRoom(
  c: Context<AppBindings>,
  path: "/complete" | "/approve" | "/redo" | "/undo" | "/adjust",
  payload: { instanceId?: string; note?: string; childId?: string; amount?: number },
): Promise<Response> {
  const { familyId, userId, role } = c.get("auth");
  const actor: Actor = { userId, role };
  const stub = c.env.FAMILY_DO.get(c.env.FAMILY_DO.idFromName(familyId));
  const res = await stub.fetch(`https://family-room.internal${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ familyId, actor, ...payload }),
  });
  return c.newResponse(await res.text(), res.status as 200, {
    "Content-Type": "application/json",
  });
}
