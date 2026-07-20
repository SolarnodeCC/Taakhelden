/**
 * Account/AVG (API-spec §3.12).
 *  - GET /account/export  → machineleesbare export van alle gezinsdata (art. 20).
 *  - DELETE /account      → 7 dagen soft delete → cascade (art. 17), met
 *                           wachtwoord-herbevestiging.
 */
import { Hono } from "hono";
import { AccountDeleteBody, ErrorCodes } from "@taakhelden/shared";
import type { AppBindings } from "../types";
import { ApiException } from "../middleware/error";
import { requireParent } from "../middleware/authz";
import { validate } from "../middleware/validate";
import { verifySecret } from "../services/passwords";
import { getUserById } from "../repo/auth";
import { collectExport, softDeleteFamily } from "../repo/account";

const PURGE_AFTER_DAYS = 7;

const account = new Hono<AppBindings>();

/** Machineleesbare download van alle gezinsdata (art. 20 AVG). */
account.get("/export", async (c) => {
  const { familyId } = requireParent(c);
  const data = await collectExport(c.env.DB, familyId);
  const filename = `taakhelden-export-${new Date().toISOString().slice(0, 10)}.json`;
  return c.json(data, 200, { "Content-Disposition": `attachment; filename="${filename}"` });
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

export default account;
