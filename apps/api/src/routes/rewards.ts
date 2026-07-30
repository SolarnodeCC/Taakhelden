import { Hono } from "hono";
import { z } from "zod";
import {
  RewardBody,
  RewardPatchBody,
  RewardView,
  RewardsViewerResponse,
  SavingsGoalView,
  ErrorCodes,
} from "@taakhelden/shared";
import type { AppBindings } from "../types";
import { ApiException } from "../middleware/error";
import { requireParent } from "../middleware/authz";
import { validate } from "../middleware/validate";
import { requireIdempotencyKey } from "../middleware/idempotency";
import { isContractV2 } from "../services/contract";
import { callFamilyRoom } from "../services/familyRoom";
import { newId } from "../services/ids";
import * as repo from "../repo/rewards";
import { balance } from "../repo/ledger";

const rewards = new Hono<AppBindings>();
const LegacyChildRewardsView = z.object({
  balance: z.number().int(),
  rewards: z.array(RewardView.extend({ affordable: z.boolean(), pinned: z.boolean() })),
  savingsGoal: SavingsGoalView.nullable(),
});

function rewardView(row: repo.RewardRow) {
  return {
    id: row.id,
    title: row.title,
    icon: row.icon,
    price: row.price,
    limitPerWeek: row.limit_per_week,
  };
}

/** Winkel. Kind: actieve beloningen + betaalbaar-markering + spaardoel-voortgang. */
rewards.get("/", async (c) => {
  const { familyId, userId, role } = c.get("auth");
  const rows = await repo.listRewards(c.env.DB, familyId);

  if (role === "parent") {
    const rewardsView = rows.map(rewardView);
    if (isContractV2(c)) {
      return c.json(RewardsViewerResponse.parse({ viewer: "parent", rewards: rewardsView }));
    }
    return c.json(z.array(RewardView).parse(rewardsView));
  }

  const [saldo, pinned] = await Promise.all([
    balance(c.env.DB, familyId, userId),
    repo.getPinnedReward(c.env.DB, familyId, userId),
  ]);
  const response = {
    balance: saldo,
    rewards: rows.map((r) => ({
      ...rewardView(r),
      affordable: saldo >= r.price,
      pinned: pinned?.reward_id === r.id,
    })),
    savingsGoal:
      pinned && !pinned.archived_at
        ? {
            rewardId: pinned.reward_id,
            title: pinned.title,
            icon: pinned.icon,
            price: pinned.price,
            progress: Math.min(1, saldo / pinned.price),
          }
        : null,
  };
  if (isContractV2(c)) {
    return c.json(RewardsViewerResponse.parse({ viewer: "child", ...response }));
  }
  return c.json(LegacyChildRewardsView.parse(response));
});

rewards.post("/", validate("json", RewardBody), async (c) => {
  const { familyId } = requireParent(c, { full: true });
  const body = c.req.valid("json");
  const id = newId("rw");
  await repo.insertReward(c.env.DB, familyId, {
    id,
    title: body.title,
    icon: body.icon,
    price: body.price,
    limitPerWeek: body.limitPerWeek,
  });
  const row = await repo.getReward(c.env.DB, familyId, id);
  return c.json(RewardView.parse(rewardView(row!)), 201);
});

rewards.patch("/:id", validate("json", RewardPatchBody), async (c) => {
  const { familyId } = requireParent(c, { full: true });
  const rewardId = c.req.param("id");
  const reward = await repo.getReward(c.env.DB, familyId, rewardId);
  if (!reward || reward.archived_at) {
    throw new ApiException(404, ErrorCodes.NOT_FOUND, "Beloning niet gevonden.");
  }
  await repo.updateReward(c.env.DB, familyId, rewardId, c.req.valid("json"));
  const updated = await repo.getReward(c.env.DB, familyId, rewardId);
  return c.json(RewardView.parse(rewardView(updated!)));
});

/** Archiveren: verdwijnt uit de winkel, historie blijft intact. */
rewards.delete("/:id", async (c) => {
  const { familyId } = requireParent(c, { full: true });
  const rewardId = c.req.param("id");
  const reward = await repo.getReward(c.env.DB, familyId, rewardId);
  if (!reward || reward.archived_at) {
    throw new ApiException(404, ErrorCodes.NOT_FOUND, "Beloning niet gevonden.");
  }
  await repo.archiveReward(c.env.DB, familyId, rewardId);
  return c.json({ ok: true });
});

/** Kopen (kind) — ledger-afboeking via de FamilyRoom-DO, Idempotency-Key verplicht. */
rewards.post("/:id/redeem", requireIdempotencyKey, async (c) => {
  const { role } = c.get("auth");
  if (role !== "child") {
    throw new ApiException(403, ErrorCodes.FORBIDDEN, "Alleen kinderen kunnen beloningen kopen.");
  }
  return callFamilyRoom(c, "/redeem", { rewardId: c.req.param("id") });
});

/** Spaardoel instellen (max 1 per kind — vervangt het vorige doel). */
rewards.post("/:id/pin", async (c) => {
  const { familyId, userId, role } = c.get("auth");
  if (role !== "child") {
    throw new ApiException(403, ErrorCodes.FORBIDDEN, "Alleen kinderen hebben een spaardoel.");
  }
  const rewardId = c.req.param("id");
  const reward = await repo.getReward(c.env.DB, familyId, rewardId);
  if (!reward || reward.archived_at) {
    throw new ApiException(404, ErrorCodes.NOT_FOUND, "Beloning niet gevonden.");
  }
  await repo.setPinnedReward(c.env.DB, familyId, userId, rewardId);
  const saldo = await balance(c.env.DB, familyId, userId);
  return c.json({
    rewardId,
    title: reward.title,
    price: reward.price,
    progress: Math.min(1, saldo / reward.price),
  });
});

export default rewards;
