import { Hono } from "hono";
import {
  CreateChildBody,
  UpdateMemberBody,
  PincodeBody,
  AttachPhotoBody,
  RevokeChildSessionsResult,
  EquipAvatarBody,
  ErrorCodes,
  MemberAvatarState,
  SetChildPauseBody,
  ChildPause,
} from "@taakhelden/shared";
import type { AppBindings } from "../types";
import { ApiException } from "../middleware/error";
import { requireParent, requireSelfOrParent } from "../middleware/authz";
import { validate } from "../middleware/validate";
import { requireIdempotencyKey } from "../middleware/idempotency";
import { newId } from "../services/ids";
import { hashSecret } from "../services/passwords";
import * as repo from "../repo/families";
import { revokeChildDeviceSessions } from "../repo/auth";
import { getPhoto, setMemberPhotoKey } from "../repo/photos";
import { EquipAvatarError, equipAvatarItems, getMemberAvatarState } from "../repo/avatar";
import { listPauses, setPause, clearPause, activePauseFor } from "../repo/pauses";

const members = new Hono<AppBindings>();

/** ageMode-afleiding uit geboortejaar (spec §3.3): young 4-7 · mid 8-12 · teen 13+. */
function deriveAgeMode(birthYear: number): "young" | "mid" | "teen" {
  const age = new Date().getFullYear() - birthYear;
  if (age <= 7) return "young";
  if (age <= 12) return "mid";
  return "teen";
}

function memberView(row: Record<string, unknown>, viewerRole: "parent" | "child") {
  const base = {
    id: row.id,
    role: row.role,
    displayName: row.display_name,
    avatarId: row.avatar_id ?? null,
  };
  if (viewerRole === "child") return base; // geen e-mails/geboortejaren van anderen
  return {
    ...base,
    permissions: row.permissions,
    ageMode: row.age_mode ?? null,
    birthYear: row.birth_year ?? null,
    email: row.email ?? null,
  };
}

members.get("/", async (c) => {
  const { familyId, role } = c.get("auth");
  const { results } = await repo.getMembers(c.env.DB, familyId);
  return c.json(results.map((r) => memberView(r as Record<string, unknown>, role)));
});

members.post("/children", validate("json", CreateChildBody), async (c) => {
  const { familyId, userId } = requireParent(c, { full: true });
  const body = c.req.valid("json");
  const id = newId("ch");
  await repo.createChild(c.env.DB, familyId, {
    id,
    displayName: body.displayName,
    birthYear: body.birthYear,
    ageMode: deriveAgeMode(body.birthYear),
    avatarId: body.avatarId ?? null,
    pincodeHash: await hashSecret(body.pincode),
    consentBy: userId,
  });
  const child = await repo.getMember(c.env.DB, familyId, id);
  return c.json(memberView(child as Record<string, unknown>, "parent"), 201);
});

members.patch("/:id", validate("json", UpdateMemberBody), async (c) => {
  const auth = c.get("auth");
  const memberId = c.req.param("id");
  const body = c.req.valid("json");

  if (auth.role === "child") {
    // Kind mag alleen zijn eigen avatar wijzigen.
    if (auth.userId !== memberId || body.displayName !== undefined || body.birthYear !== undefined) {
      throw new ApiException(403, ErrorCodes.FORBIDDEN, "Dit is niet van jou.");
    }
  } else {
    requireParent(c, { full: true });
  }

  const member = await repo.getMember(c.env.DB, auth.familyId, memberId);
  if (!member) {
    throw new ApiException(404, ErrorCodes.NOT_FOUND, "Gezinslid niet gevonden.");
  }
  await repo.updateMember(c.env.DB, auth.familyId, memberId, {
    ...body,
    ageMode: body.birthYear !== undefined ? deriveAgeMode(body.birthYear) : undefined,
  });
  const updated = await repo.getMember(c.env.DB, auth.familyId, memberId);
  return c.json(memberView(updated as Record<string, unknown>, auth.role));
});

members.get("/:id/avatar", async (c) => {
  const memberId = c.req.param("id");
  const auth = requireSelfOrParent(c, memberId);
  const state = await getMemberAvatarState(c.env.DB, auth.familyId, memberId);
  if (!state) {
    throw new ApiException(404, ErrorCodes.NOT_FOUND, "Kindprofiel niet gevonden.");
  }
  return c.json(MemberAvatarState.parse(state));
});

members.patch(
  "/:id/avatar",
  requireIdempotencyKey,
  validate("json", EquipAvatarBody),
  async (c) => {
    const memberId = c.req.param("id");
    const auth = requireSelfOrParent(c, memberId);
    try {
      const state = await equipAvatarItems(
        c.env.DB,
        auth.familyId,
        memberId,
        c.req.valid("json"),
      );
      if (!state) {
        throw new ApiException(404, ErrorCodes.NOT_FOUND, "Kindprofiel niet gevonden.");
      }
      return c.json(MemberAvatarState.parse(state));
    } catch (err) {
      if (err instanceof EquipAvatarError) {
        if (err.code === "ITEM_LOCKED") {
          throw new ApiException(
            403,
            ErrorCodes.FORBIDDEN,
            "Dit item is nog niet ontgrendeld — bijna!",
          );
        }
        throw new ApiException(
          400,
          ErrorCodes.VALIDATION_FAILED,
          "Dit item past niet bij dat vakje.",
        );
      }
      throw err;
    }
  },
);

members.post("/:id/pincode", validate("json", PincodeBody), async (c) => {
  const { familyId } = requireParent(c, { full: true });
  const memberId = c.req.param("id");
  const member = await repo.getMember(c.env.DB, familyId, memberId);
  if (!member || member.role !== "child") {
    throw new ApiException(404, ErrorCodes.NOT_FOUND, "Kindprofiel niet gevonden.");
  }
  await repo.setMemberPincode(c.env.DB, familyId, memberId, await hashSecret(c.req.valid("json").pincode));
  return c.json({ ok: true });
});

members.post("/:id/device-sessions/revoke", async (c) => {
  const { familyId } = requireParent(c, { full: true });
  const memberId = c.req.param("id");
  const member = await repo.getMember(c.env.DB, familyId, memberId);
  if (!member || member.role !== "child") {
    throw new ApiException(404, ErrorCodes.NOT_FOUND, "Kindprofiel niet gevonden.");
  }
  return c.json(
    RevokeChildSessionsResult.parse({
      ok: true,
      revokedCount: await revokeChildDeviceSessions(c.env.DB, familyId, memberId),
    }),
  );
});

/** Profielfoto koppelen na de presigned-flow (§3.6). Zichtbaar zodra 'ready'. */
members.post("/:id/photo", validate("json", AttachPhotoBody), async (c) => {
  const { familyId } = requireParent(c, { full: true });
  const memberId = c.req.param("id");
  const member = await repo.getMember(c.env.DB, familyId, memberId);
  if (!member) {
    throw new ApiException(404, ErrorCodes.NOT_FOUND, "Gezinslid niet gevonden.");
  }
  const photo = await getPhoto(c.env.DB, familyId, c.req.valid("json").photoId);
  if (!photo || photo.purpose !== "profile" || photo.ref_id !== memberId) {
    throw new ApiException(404, ErrorCodes.NOT_FOUND, "Foto niet gevonden.");
  }
  if (photo.status === "intent" || photo.status === "failed") {
    throw new ApiException(409, ErrorCodes.INVALID_STATUS, "Upload de foto eerst.");
  }
  await setMemberPhotoKey(c.env.DB, familyId, memberId, photo.r2_key);
  return c.json({ ok: true, photoId: photo.id, status: photo.status });
});

members.delete("/:id", async (c) => {
  const { familyId } = requireParent(c, { full: true });
  const memberId = c.req.param("id");
  const member = await repo.getMember(c.env.DB, familyId, memberId);
  if (!member || member.role !== "child") {
    throw new ApiException(404, ErrorCodes.NOT_FOUND, "Kindprofiel niet gevonden.");
  }
  await repo.softDeleteMember(c.env.DB, familyId, memberId);
  return c.json({ ok: true, deletedAt: new Date().toISOString() });
});

// --- Rustschild (WS-PAUSE) ---

function pauseView(row: {
  id: string;
  child_id: string;
  starts_on: string;
  ends_on: string | null;
  reason: string | null;
  cleared_at: string | null;
}): ChildPause {
  const today = new Date().toISOString().slice(0, 10);
  const active =
    row.cleared_at === null &&
    row.starts_on <= today &&
    (row.ends_on === null || row.ends_on >= today);
  return ChildPause.parse({
    id: row.id,
    childId: row.child_id,
    startsOn: row.starts_on,
    endsOn: row.ends_on ?? null,
    reason: row.reason ?? null,
    active,
  });
}

/** GET /members/:childId/pause — actieve + geplande pauzes (ouder of kind-zelf). */
members.get("/:id/pause", async (c) => {
  const childId = c.req.param("id");
  const auth = requireSelfOrParent(c, childId);

  const member = await repo.getMember(c.env.DB, auth.familyId, childId);
  if (!member || member.role !== "child") {
    throw new ApiException(404, ErrorCodes.NOT_FOUND, "Kindprofiel niet gevonden.");
  }

  const rows = await listPauses(c.env.DB, auth.familyId, childId);
  return c.json({ pauses: rows.map((r) => pauseView(r as Parameters<typeof pauseView>[0])) });
});

/** PUT /members/:childId/pause — stel pauze in (ouder full). Idempotency-Key verplicht. */
members.put("/:id/pause", requireIdempotencyKey, validate("json", SetChildPauseBody), async (c) => {
  const { familyId, userId } = requireParent(c, { full: true });
  const childId = c.req.param("id");
  const body = c.req.valid("json");

  const member = await repo.getMember(c.env.DB, familyId, childId);
  if (!member || member.role !== "child") {
    throw new ApiException(404, ErrorCodes.NOT_FOUND, "Kindprofiel niet gevonden.");
  }

  const id = await setPause(c.env.DB, familyId, {
    childId,
    startsOn: body.startsOn,
    endsOn: body.endsOn ?? null,
    reason: body.reason ?? null,
    createdBy: userId,
  });

  const row = await activePauseFor(c.env.DB, familyId, childId, body.startsOn);
  return c.json(
    pauseView(
      (row ?? {
        id,
        child_id: childId,
        starts_on: body.startsOn,
        ends_on: body.endsOn ?? null,
        reason: body.reason ?? null,
        cleared_at: null,
      }) as Parameters<typeof pauseView>[0],
    ),
    201,
  );
});

/** DELETE /members/:childId/pause/:pauseId — beëindig een pauze (ouder full). */
members.delete("/:id/pause/:pauseId", requireIdempotencyKey, async (c) => {
  const { familyId } = requireParent(c, { full: true });
  const childId = c.req.param("id");
  const pauseId = c.req.param("pauseId");

  const member = await repo.getMember(c.env.DB, familyId, childId);
  if (!member || member.role !== "child") {
    throw new ApiException(404, ErrorCodes.NOT_FOUND, "Kindprofiel niet gevonden.");
  }

  const cleared = await clearPause(c.env.DB, familyId, pauseId);
  if (!cleared) {
    throw new ApiException(404, ErrorCodes.NOT_FOUND, "Pauze niet gevonden of al beëindigd.");
  }
  return c.json({ ok: true, clearedAt: new Date().toISOString() });
});

export default members;
