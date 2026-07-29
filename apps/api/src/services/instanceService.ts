import { ErrorCodes, type InstanceView } from "@taakhelden/shared";
import { ApiException } from "../middleware/error";
import { getFamily, listChildren } from "../repo/families";
import * as instances from "../repo/instances";
import { parseInstanceView as instanceViewFromRow } from "./instanceView";
import { localDate } from "./time";
import type { Actor } from "./pointsEngine";

const MOVABLE_STATUSES = new Set(["open", "open_redo"]);

/** Verplaatst één open instance naar een ander doelslot (datum en/of kind). */
export async function applyMoveInstance(
  db: D1Database,
  familyId: string,
  instanceId: string,
  actor: Actor,
  target: { date: string; childId: string },
): Promise<{ view: InstanceView; status: string; childId: string; date: string }> {
  if (actor.role !== "parent") {
    throw new ApiException(403, ErrorCodes.FORBIDDEN, "Alleen voor ouders.");
  }

  const inst = await instances.getInstance(db, familyId, instanceId);
  if (!inst) {
    throw new ApiException(404, ErrorCodes.NOT_FOUND, "Taak niet gevonden.");
  }
  if (!MOVABLE_STATUSES.has(inst.status)) {
    throw new ApiException(409, ErrorCodes.INVALID_STATUS, "Deze taak kan niet meer verplaatst worden.");
  }

  if (inst.date === target.date && inst.child_id === target.childId) {
    const row = await instances.getInstanceWithTask(db, familyId, instanceId);
    if (!row) {
      throw new ApiException(404, ErrorCodes.NOT_FOUND, "Taak niet gevonden.");
    }
    const view = instanceViewFromRow(row);
    return { view, status: view.status, childId: view.childId, date: view.date };
  }

  const family = await getFamily(db, familyId);
  if (!family) {
    throw new ApiException(404, ErrorCodes.NOT_FOUND, "Gezin niet gevonden.");
  }
  const today = localDate(family.timezone as string);
  if (target.date < today) {
    throw new ApiException(400, ErrorCodes.VALIDATION_FAILED, "Je kunt een taak niet naar het verleden verplaatsen.");
  }

  const children = await listChildren(db, familyId);
  if (!children.some((c) => c.id === target.childId)) {
    throw new ApiException(400, ErrorCodes.VALIDATION_FAILED, "Ongeldig kind.");
  }

  const slotTaken = await instances.hasInstanceSlot(
    db,
    familyId,
    inst.task_id,
    target.childId,
    target.date,
    instanceId,
  );
  if (slotTaken) {
    throw new ApiException(409, ErrorCodes.INSTANCE_SLOT_TAKEN, "Hier staat al een taak op deze dag.");
  }

  const moved = await instances.moveInstance(db, familyId, instanceId, target);
  if (!moved) {
    throw new ApiException(409, ErrorCodes.INVALID_STATUS, "Deze taak kan niet meer verplaatst worden.");
  }

  const row = await instances.getInstanceWithTask(db, familyId, instanceId);
  if (!row) {
    throw new ApiException(404, ErrorCodes.NOT_FOUND, "Taak niet gevonden.");
  }
  const view = instanceViewFromRow(row);
  return { view, status: view.status, childId: view.childId, date: view.date };
}
