/**
 * Queue-consumer voor de asynchrone data-export (AVG art. 20). Bouwt één ZIP met
 * de machineleesbare JSON-export én de (EXIF-gestripte) foto-bytes uit R2, schrijft
 * die naar export/<familyId>/<id>.zip, en markeert de job 'ready'. Lukt het niet,
 * dan 'failed' — nooit een halve of lekkende export. Een export is opnieuw op te
 * vragen, dus een fout is een terminale status i.p.v. een eindeloze retry.
 */
import { zipSync } from "fflate";
import type { Env } from "../types";
import {
  collectExport,
  listReadyPhotosForExport,
  setExportReady,
  setExportFailed,
  getExportJob,
} from "../repo/account";
import { exportKey } from "../services/exportService";

export interface ExportJob {
  exportId: string;
  familyId: string;
}

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/heic": "heic",
};

export async function processExports(batch: MessageBatch, env: Env) {
  for (const msg of batch.messages) {
    await processOne(msg.body as ExportJob, env);
    msg.ack();
  }
}

async function processOne(job: ExportJob, env: Env) {
  const existing = await getExportJob(env.DB, job.familyId, job.exportId);
  if (!existing || existing.status !== "pending") return; // al verwerkt of ingetrokken

  try {
    const data = await collectExport(env.DB, job.familyId);
    const files: Record<string, Uint8Array> = {
      "export.json": new TextEncoder().encode(JSON.stringify(data, null, 2)),
    };

    const photos = await listReadyPhotosForExport(env.DB, job.familyId);
    for (const photo of photos) {
      const object = await env.PHOTOS.get(photo.r2_key);
      if (!object) continue; // lifecycle kan een taakfoto al verwijderd hebben
      const ext = EXT[photo.content_type] ?? "bin";
      files[`photos/${photo.id}.${ext}`] = new Uint8Array(await object.arrayBuffer());
    }

    const zip = zipSync(files);
    const key = exportKey(job.familyId, job.exportId);
    await env.PHOTOS.put(key, zip);
    await setExportReady(env.DB, job.familyId, job.exportId, key, zip.byteLength);
  } catch {
    // Nooit namen/URL's loggen (privacyregel 5); de ouder kan opnieuw exporteren.
    await setExportFailed(env.DB, job.familyId, job.exportId);
  }
}
