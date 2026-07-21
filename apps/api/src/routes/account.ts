/**
 * Account/AVG (API-spec §3.12).
 *  - POST /account/export        → start een asynchrone export-job (art. 20).
 *  - GET  /account/export/:id     → status + (indien klaar) kortlevende downloadlink.
 *  - GET  /account/export/:id/file → publiek, HMAC-gesigneerd: stream de ZIP.
 *  - DELETE /account             → 7 dagen soft delete → cascade (art. 17), met
 *                                  wachtwoord-herbevestiging.
 */
import { Hono } from "hono";
import { AccountDeleteBody, ErrorCodes } from "@taakhelden/shared";
import type { AppBindings } from "../types";
import { ApiException } from "../middleware/error";
import { requireParent } from "../middleware/authz";
import { validate } from "../middleware/validate";
import { verifySecret } from "../services/passwords";
import { newId } from "../services/ids";
import { getUserById } from "../repo/auth";
import {
  softDeleteFamily,
  createExportJob,
  getExportJob,
} from "../repo/account";
import {
  signExportDownload,
  exportDownloadUrl,
  verifyExportDownload,
} from "../services/exportService";
import type { ExportJob } from "../jobs/exportConsumer";

const PURGE_AFTER_DAYS = 7;

const account = new Hono<AppBindings>();

/** Start een export-job (art. 20). De ZIP wordt asynchroon door de queue gebouwd. */
account.post("/export", async (c) => {
  const { familyId } = requireParent(c);
  const exportId = newId("exp");
  await createExportJob(c.env.DB, familyId, exportId);
  await c.env.EXPORT_QUEUE.send({ exportId, familyId } satisfies ExportJob);
  return c.json({ exportId, status: "pending" }, 202);
});

/** Status van een export-job; zodra klaar een kortlevende downloadlink. */
account.get("/export/:id", async (c) => {
  const { familyId } = requireParent(c);
  const exportId = c.req.param("id");
  const job = await getExportJob(c.env.DB, familyId, exportId);
  if (!job) {
    throw new ApiException(404, ErrorCodes.NOT_FOUND, "Export niet gevonden.");
  }
  if (job.status !== "ready") {
    return c.json({ exportId, status: job.status });
  }
  const { exp, sig } = await signExportDownload(c.env.JWT_SECRET, familyId, exportId);
  const origin = new URL(c.req.url).origin;
  return c.json({
    exportId,
    status: "ready",
    downloadUrl: exportDownloadUrl(origin, familyId, exportId, exp, sig),
  });
});

/** Verwijder het hele gezin — bevestigd met wachtwoord-herinvoer. */
account.delete("/", validate("json", AccountDeleteBody), async (c) => {
  const { familyId, userId } = requireParent(c, { full: true });

  const user = await getUserById(c.env.DB, userId);
  const hash = user?.password_hash as string | undefined;
  const confirmed = hash && (await verifySecret(c.req.valid("json").password, hash));
  if (!confirmed) {
    throw new ApiException(401, ErrorCodes.INVALID_CREDENTIALS, "Wachtwoord klopt niet.");
  }

  const deletedAt = await softDeleteFamily(c.env.DB, familyId);
  const purgeAfter = new Date(
    new Date(deletedAt).getTime() + PURGE_AFTER_DAYS * 24 * 3600 * 1000,
  ).toISOString();
  return c.json({ deletedAt, purgeAfter });
});

/**
 * Publieke, HMAC-gesigneerde download van het ZIP-bestand (à la de foto-transfer):
 * geen JWT, autorisatie zit in de handtekening. Vóór de auth-middleware gemount.
 */
export const exportDownload = new Hono<AppBindings>();

exportDownload.get("/export/:id/file", async (c) => {
  const exportId = c.req.param("id");
  const familyId = c.req.query("fam");
  const ok = await verifyExportDownload(
    c.env.JWT_SECRET,
    familyId,
    exportId,
    c.req.query("exp"),
    c.req.query("sig"),
  );
  if (!ok || !familyId) {
    throw new ApiException(403, ErrorCodes.FORBIDDEN, "Ongeldige of verlopen downloadlink.");
  }
  const job = await getExportJob(c.env.DB, familyId, exportId);
  if (!job || job.status !== "ready" || !job.r2_key) {
    throw new ApiException(404, ErrorCodes.NOT_FOUND, "Export niet gevonden.");
  }
  const object = await c.env.PHOTOS.get(job.r2_key);
  if (!object) {
    throw new ApiException(404, ErrorCodes.NOT_FOUND, "Export niet gevonden.");
  }
  const filename = `taakhelden-export-${exportId}.zip`;
  return c.body(object.body, 200, {
    "Content-Type": "application/zip",
    "Content-Disposition": `attachment; filename="${filename}"`,
  });
});

export default account;
