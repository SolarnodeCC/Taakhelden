import { Hono } from "hono";
import { UploadIntentBody, PHOTO_MAX_BYTES, PHOTO_DAILY_LIMIT, ErrorCodes } from "@taakhelden/shared";
import type { AppBindings } from "../types";
import { ApiException } from "../middleware/error";
import { requireParent } from "../middleware/authz";
import { validate } from "../middleware/validate";
import { newId } from "../services/ids";
import {
  signPhotoTransfer,
  verifyPhotoTransfer,
  photoKey,
  transferUrl,
  UPLOAD_URL_TTL_SECONDS,
  DOWNLOAD_URL_TTL_SECONDS,
} from "../services/photoService";
import * as repo from "../repo/photos";
import { getInstance } from "../repo/instances";
import { getMember } from "../repo/families";

/**
 * Transfer-endpoints (PUT upload / GET file) staan VÓÓR de auth-middleware:
 * de kortlevende HMAC-handtekening in de URL is hier de autorisatie, zodat de
 * app kan up-/downloaden zonder Authorization-header (à la presigned URL).
 */
export const photoTransfer = new Hono<AppBindings>();

photoTransfer.put("/:id/upload", async (c) => {
  const photoId = c.req.param("id");
  const familyId = c.req.query("fam");
  const ok = await verifyPhotoTransfer(
    c.env.JWT_SECRET, familyId, photoId, "put", c.req.query("exp"), c.req.query("sig"),
  );
  if (!ok) {
    throw new ApiException(403, ErrorCodes.FORBIDDEN, "Deze uploadlink is verlopen. Vraag een nieuwe aan.");
  }
  const photo = await repo.getPhoto(c.env.DB, familyId!, photoId);
  if (!photo || (photo.status !== "intent" && photo.status !== "uploaded")) {
    throw new ApiException(409, ErrorCodes.INVALID_STATUS, "Deze upload is al verwerkt.");
  }

  const body = await c.req.arrayBuffer();
  if (body.byteLength === 0 || body.byteLength > PHOTO_MAX_BYTES) {
    throw new ApiException(400, ErrorCodes.VALIDATION_FAILED, "Foto is te groot (max 10 MB).");
  }
  await c.env.PHOTOS.put(photo.r2_key, body, {
    httpMetadata: { contentType: photo.content_type },
  });
  await repo.setPhotoStatus(c.env.DB, familyId!, photoId, "uploaded");
  return c.json({ ok: true });
});

/** Foto's zijn pas opvraagbaar na de EXIF-strip (status 'ready') — privacyregel 5. */
photoTransfer.get("/:id/file", async (c) => {
  const photoId = c.req.param("id");
  const familyId = c.req.query("fam");
  const ok = await verifyPhotoTransfer(
    c.env.JWT_SECRET, familyId, photoId, "get", c.req.query("exp"), c.req.query("sig"),
  );
  if (!ok) {
    throw new ApiException(403, ErrorCodes.FORBIDDEN, "Deze link is verlopen. Vraag een nieuwe aan.");
  }
  const photo = await repo.getPhoto(c.env.DB, familyId!, photoId);
  if (!photo || photo.status !== "ready") {
    throw new ApiException(404, ErrorCodes.NOT_FOUND, "Foto niet gevonden.");
  }
  const object = await c.env.PHOTOS.get(photo.r2_key);
  if (!object) {
    throw new ApiException(404, ErrorCodes.NOT_FOUND, "Foto niet gevonden.");
  }
  return c.newResponse(object.body as ReadableStream, 200, {
    "Content-Type": photo.content_type,
    "Cache-Control": "private, max-age=300",
  });
});

// --- geauthenticeerde photo-API (§3.6) ---

const photos = new Hono<AppBindings>();

photos.post("/upload-intent", validate("json", UploadIntentBody), async (c) => {
  const { familyId, userId, role } = c.get("auth");
  const body = c.req.valid("json");

  if (body.purpose === "task") {
    // Rollenmatrix §5: alleen het kind zelf uploadt taakfoto's.
    if (role !== "child") {
      throw new ApiException(403, ErrorCodes.FORBIDDEN, "Alleen kinderen uploaden taakfoto's.");
    }
    const inst = await getInstance(c.env.DB, familyId, body.instanceId!);
    if (!inst || inst.child_id !== userId) {
      throw new ApiException(404, ErrorCodes.NOT_FOUND, "Deze taak kennen we niet.");
    }
    // Max 20 uploads per kind per dag (spec §4); UTC-dag is hier precies genoeg.
    const quotaKey = `photoq:${userId}:${new Date().toISOString().slice(0, 10)}`;
    const used = Number((await c.env.KV.get(quotaKey)) ?? "0");
    if (used >= PHOTO_DAILY_LIMIT) {
      throw new ApiException(429, ErrorCodes.RATE_LIMITED, "Genoeg foto's voor vandaag — morgen weer!");
    }
    await c.env.KV.put(quotaKey, String(used + 1), { expirationTtl: 60 * 60 * 24 });
  } else {
    requireParent(c, { full: true });
    const member = await getMember(c.env.DB, familyId, body.memberId!);
    if (!member) {
      throw new ApiException(404, ErrorCodes.NOT_FOUND, "Gezinslid niet gevonden.");
    }
  }

  const photoId = newId("ph");
  const refId = body.purpose === "task" ? body.instanceId! : body.memberId!;
  await repo.insertPhoto(c.env.DB, familyId, {
    id: photoId,
    ownerId: userId,
    purpose: body.purpose,
    refId,
    r2Key: photoKey(body.purpose, familyId, photoId),
    contentType: body.contentType,
    bytes: body.bytes,
  });

  const { exp, sig } = await signPhotoTransfer(
    c.env.JWT_SECRET, familyId, photoId, "put", UPLOAD_URL_TTL_SECONDS,
  );
  const origin = new URL(c.req.url).origin;
  return c.json({ photoId, uploadUrl: transferUrl(origin, familyId, photoId, "put", exp, sig) }, 201);
});

/** Na de PUT: bevestigen → Queue-job (EXIF/GPS-strip) → status 'ready'. */
photos.post("/:id/confirm", async (c) => {
  const { familyId, userId } = c.get("auth");
  const photoId = c.req.param("id");
  const photo = await repo.getPhoto(c.env.DB, familyId, photoId);
  if (!photo || photo.owner_id !== userId) {
    throw new ApiException(404, ErrorCodes.NOT_FOUND, "Foto niet gevonden.");
  }
  if (photo.status === "processing" || photo.status === "ready") {
    return c.json({ photoId, status: photo.status }); // idempotent: nogmaals bevestigen kan geen kwaad
  }
  if (photo.status !== "uploaded") {
    throw new ApiException(409, ErrorCodes.INVALID_STATUS, "Upload de foto eerst.");
  }
  const object = await c.env.PHOTOS.head(photo.r2_key);
  if (!object) {
    throw new ApiException(409, ErrorCodes.INVALID_STATUS, "Upload de foto eerst.");
  }
  await repo.setPhotoStatus(c.env.DB, familyId, photoId, "processing");
  await c.env.PHOTO_QUEUE.send({ photoId, familyId });
  return c.json({ photoId, status: "processing" });
});

/** Korte signed GET-URL — alleen eigen gezin; kind alleen eigen foto's. */
photos.get("/:id", async (c) => {
  const { familyId, userId, role } = c.get("auth");
  const photoId = c.req.param("id");
  const photo = await repo.getPhoto(c.env.DB, familyId, photoId);
  if (!photo || (role === "child" && photo.owner_id !== userId)) {
    throw new ApiException(404, ErrorCodes.NOT_FOUND, "Foto niet gevonden.");
  }
  let url: string | null = null;
  if (photo.status === "ready") {
    const { exp, sig } = await signPhotoTransfer(
      c.env.JWT_SECRET, familyId, photoId, "get", DOWNLOAD_URL_TTL_SECONDS,
    );
    url = transferUrl(new URL(c.req.url).origin, familyId, photoId, "get", exp, sig);
  }
  return c.json({ photoId, status: photo.status, url });
});

export default photos;
