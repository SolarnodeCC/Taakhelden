import { Hono } from "hono";
import {
  CreateFamilyGoalBody,
  ErrorCodes,
  FamilyGoalProgressResponse,
  FamilyGoalsResponse,
  PatchFamilyGoalBody,
} from "@taakhelden/shared";
import type { AppBindings } from "../types";
import { ApiException } from "../middleware/error";
import { requireParent } from "../middleware/authz";
import { validate } from "../middleware/validate";
import { requireIdempotencyKey } from "../middleware/idempotency";
import {
  FamilyGoalError,
  computeGoalProgress,
  createFamilyGoal,
  getActiveFamilyGoal,
  getFamilyGoal,
  listFamilyGoals,
  patchFamilyGoal,
} from "../repo/familyGoals";

const familyGoals = new Hono<AppBindings>();

familyGoals.get("/", async (c) => {
  const { familyId } = c.get("auth");
  const goals = await listFamilyGoals(c.env.DB, familyId);
  const body: FamilyGoalsResponse = { goals };
  return c.json(body);
});

familyGoals.get("/active/progress", async (c) => {
  const { familyId } = c.get("auth");
  const goal = await getActiveFamilyGoal(c.env.DB, familyId);
  if (!goal) {
    const body: FamilyGoalProgressResponse = { progress: null };
    return c.json(body);
  }
  const progress = await computeGoalProgress(c.env.DB, familyId, goal);
  // Read-only: persistence happens on ledger writes (FamilyRoom). Overlay
  // "completed" in the response when the target is already met so UI stays
  // accurate between the last earn and the next mutation.
  if (progress.earnedPoints >= progress.targetPoints && progress.status === "active") {
    progress.status = "completed";
  }
  return c.json({ progress } satisfies FamilyGoalProgressResponse);
});

familyGoals.post(
  "/",
  requireIdempotencyKey,
  validate("json", CreateFamilyGoalBody),
  async (c) => {
    const { familyId } = requireParent(c, { full: true });
    try {
      const goal = await createFamilyGoal(c.env.DB, familyId, c.req.valid("json"));
      return c.json(goal, 201);
    } catch (err) {
      if (err instanceof FamilyGoalError) {
        if (err.code === "ACTIVE_EXISTS") {
          throw new ApiException(
            409,
            ErrorCodes.VALIDATION_FAILED,
            "Er is al een actief gezinsdoel. Rond dat eerst af of archiveer het.",
          );
        }
        throw new ApiException(400, ErrorCodes.VALIDATION_FAILED, "Onbekend kindprofiel in dit gezin.");
      }
      throw err;
    }
  },
);

familyGoals.patch(
  "/:id",
  requireIdempotencyKey,
  validate("json", PatchFamilyGoalBody),
  async (c) => {
    const { familyId } = requireParent(c, { full: true });
    const goalId = c.req.param("id");
    const updated = await patchFamilyGoal(c.env.DB, familyId, goalId, c.req.valid("json"));
    if (!updated) {
      throw new ApiException(404, ErrorCodes.NOT_FOUND, "Gezinsdoel niet gevonden.");
    }
    return c.json(updated);
  },
);

familyGoals.get("/:id", async (c) => {
  const { familyId } = c.get("auth");
  const goal = await getFamilyGoal(c.env.DB, familyId, c.req.param("id"));
  if (!goal) {
    throw new ApiException(404, ErrorCodes.NOT_FOUND, "Gezinsdoel niet gevonden.");
  }
  return c.json(goal);
});

export default familyGoals;
