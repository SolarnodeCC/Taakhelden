import { Hono } from "hono";
import type { AppBindings, Env } from "./types";
import { errorHandler } from "./middleware/error";
import { authMiddleware } from "./middleware/auth";
import { idempotency } from "./middleware/idempotency";
import { rateLimitSubject } from "./middleware/ratelimit";
import authRoutes from "./routes/auth";
import familyRoutes, { parentAccept } from "./routes/families";
import memberRoutes from "./routes/members";
import taskRoutes from "./routes/tasks";
import proposalRoutes from "./routes/proposals";
import instanceRoutes from "./routes/instances";
import pointsRoutes from "./routes/points";
import rewardRoutes from "./routes/rewards";
import redemptionRoutes from "./routes/redemptions";
import photoRoutes, { photoTransfer } from "./routes/photos";
import deviceRoutes from "./routes/devices";
import syncRoutes from "./routes/sync";
import badgeRoutes from "./routes/badges";
import avatarRoutes from "./routes/avatar";
import familyGoalsRoutes from "./routes/familyGoals";
import accountRoutes, { exportDownload } from "./routes/account";
import notificationRoutes from "./routes/notifications";
import wsRoutes, { handleWsUpgrade } from "./routes/ws";
import insightsRoutes from "./routes/insights";

const app = new Hono<AppBindings>().basePath("/v1");

app.onError(errorHandler);

/**
 * Beveiligingsheaders op élk API-antwoord. De Worker is rechtstreeks bereikbaar
 * (iOS praat er direct mee) en serveert bij `/photos/:id/file` door gebruikers
 * geüploade bytes, dus `nosniff` hoort hier en niet alleen op de web-app.
 * `no-referrer` houdt de ondertekende transfer-URL's uit `Referer`-headers.
 */
app.use("*", async (c, next) => {
  await next();
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Referrer-Policy", "no-referrer");
  c.header("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
});
app.get("/health", async (c) => {
  // Lightweight readiness for deploy smoke tests — never expose secret values
  // or whether JWT_SECRET is configured (info disclosure).
  let db: boolean;
  try {
    db = (await c.env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>())?.ok === 1;
  } catch {
    db = false;
  }
  const ready = db && Boolean(c.env.JWT_SECRET);
  return c.json({ ok: ready, db }, ready ? 200 : 503);
});

// Publiek (eigen rate limits + Turnstile in de handlers)
app.route("/auth", authRoutes);
// Co-ouder accept-flow: token uit de uitnodigingsmail, dus vóór de auth-middleware.
app.route("/families", parentAccept);
// Foto-transfer: HMAC-signed URLs i.p.v. JWT (à la presigned, zie routes/photos.ts)
app.route("/photos", photoTransfer);
// Export-download: HMAC-signed URL (à la foto-transfer), dus vóór de auth-middleware.
app.route("/account", exportDownload);
// Publiek: de ws-upgrade authenticeert via ?token= (browser-WebSocket kan geen
// Authorization-header sturen), dus vóór de auth-middleware.
app.get("/ws", (c) => handleWsUpgrade(c));

// Alles hieronder vereist een geldige JWT
app.use("*", authMiddleware);
// Basislimiet per ingelogde gebruiker. Staat hier — niet per route — zodat een
// nieuwe route beschermd is zonder eraan te denken; routes met een strengere
// eis (export, ws-token) zetten daar bovenop hun eigen limiet. Keyt op userId,
// dus onafhankelijk van of het client-IP doorkomt.
app.use("*", async (c, next) => {
  const { userId } = c.get("auth");
  await rateLimitSubject(c, "user", userId, 300, 60);
  return next();
});
// Optional Idempotency-Key replay for authenticated mutations (CLAUDE.md §2).
// Ledger routes still require the header via requireIdempotencyKey.
app.use("*", async (c, next) => {
  const method = c.req.method;
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return next();
  }
  return idempotency(c, next);
});
app.route("/families", familyRoutes);
app.route("/members", memberRoutes);
// Vóór /tasks gemount: /tasks/proposals is een eigen resource (WS-PROPOSAL).
app.route("/tasks/proposals", proposalRoutes);
app.route("/tasks", taskRoutes);
app.route("/instances", instanceRoutes);
app.route("/points", pointsRoutes);
app.route("/rewards", rewardRoutes);
app.route("/redemptions", redemptionRoutes);
app.route("/photos", photoRoutes);
app.route("/devices", deviceRoutes);
app.route("/sync", syncRoutes);
app.route("/badges", badgeRoutes);
app.route("/avatar", avatarRoutes);
app.route("/families/me/goals", familyGoalsRoutes);
app.route("/families/me/insights", insightsRoutes);
app.route("/account", accountRoutes);
app.route("/notification-settings", notificationRoutes);
app.route("/ws", wsRoutes);

export default {
  fetch: app.fetch,
  scheduled: async (event: ScheduledEvent, env: Env, ctx: ExecutionContext) => {
    const { runCron } = await import("./jobs/cron");
    ctx.waitUntil(runCron(event.cron, env));
  },
  queue: async (batch: MessageBatch, env: Env) => {
    if (batch.queue === "export-processing") {
      const { processExports } = await import("./jobs/exportConsumer");
      await processExports(batch, env);
    } else {
      const { processPhotos } = await import("./jobs/photoConsumer");
      await processPhotos(batch, env);
    }
  },
};

export { FamilyRoom } from "./do/FamilyRoom";
