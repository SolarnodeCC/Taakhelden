/**
 * Queue-consumer: EXIF/GPS-strip vóór een foto zichtbaar wordt (privacyregel 5).
 * Lukt strippen niet, dan wordt het R2-object verwijderd en de foto 'failed' —
 * liever geen foto dan een foto met locatiedata van een kind.
 * Thumbnails: TODO — vergt beelddecodering (Cloudflare Images), geen privacy-blocker.
 */
import type { Env } from "../types";
import { stripImageMetadata } from "../services/exif";
import { getPhoto, setPhotoStatus, markInstancePhotoReady, setMemberPhotoKey } from "../repo/photos";

export interface PhotoJob {
  photoId: string;
  familyId: string;
}

export async function processPhotos(batch: MessageBatch, env: Env) {
  for (const msg of batch.messages) {
    try {
      await processOne(msg.body as PhotoJob, env);
      msg.ack();
    } catch {
      msg.retry(); // transiënte fout (R2/D1): opnieuw proberen
    }
  }
}

async function processOne(job: PhotoJob, env: Env) {
  const photo = await getPhoto(env.DB, job.familyId, job.photoId);
  if (!photo || photo.status !== "processing") return; // al verwerkt of ingetrokken

  const object = await env.PHOTOS.get(photo.r2_key);
  if (!object) {
    await setPhotoStatus(env.DB, job.familyId, job.photoId, "failed");
    return;
  }

  const stripped = stripImageMetadata(new Uint8Array(await object.arrayBuffer()), photo.content_type);
  if (!stripped) {
    await env.PHOTOS.delete(photo.r2_key);
    await setPhotoStatus(env.DB, job.familyId, job.photoId, "failed");
    return;
  }

  await env.PHOTOS.put(photo.r2_key, stripped, {
    httpMetadata: { contentType: photo.content_type },
  });
  await setPhotoStatus(env.DB, job.familyId, job.photoId, "ready");

  if (photo.purpose === "task") {
    await markInstancePhotoReady(env.DB, job.familyId, photo.r2_key);
  } else if (photo.ref_id) {
    await setMemberPhotoKey(env.DB, job.familyId, photo.ref_id, photo.r2_key);
  }
}
