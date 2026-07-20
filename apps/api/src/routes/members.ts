import { Hono } from "hono";
import { CreateChildBody, UpdateMemberBody, PincodeBody, AttachPhotoBody, ErrorCodes } from "@taakhelden/shared";
import type { AppBindings } from "../types";
import { ApiException } from "../middleware/error";
import { requireParent } from "../middleware/authz";
import { validate } from "../middleware/validate";
import { newId } from "../services/ids";
import { hashSecret } from "../services/passwords";
import * as repo from "../repo/families";
import { getPhoto, setMemberPhotoKey } from "../repo/photos";

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

export default members;
