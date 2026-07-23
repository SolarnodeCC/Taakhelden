import { Hono } from "hono";
import type { AppBindings, Env } from "./types";
import { errorHandler } from "./middleware/error";
import { authMiddleware } from "./middleware/auth";
import authRoutes from "./routes/auth";
import familyRoutes, { parentAccept } from "./routes/families";
import memberRoutes from "./routes/members";
import taskRoutes from "./routes/tasks";
import instanceRoutes from "./routes/instances";
import pointsRoutes from "./routes/points";
import rewardRoutes from "./routes/rewards";
import redemptionRoutes from "./routes/redemptions";
import photoRoutes, { photoTransfer } from "./routes/photos";
import deviceRoutes from "./routes/devices";
import syncRoutes from "./routes/sync";
import badgeRoutes from "./routes/badges";
import accountRoutes, { exportDownload } from "./routes/account";
import notificationRoutes from "./routes/notifications";
import wsRoutes, { handleWsUpgrade } from "./routes/ws";

const app = new Hono<AppBindings>().basePath("/v1");

app.onError(errorHandler);
app.get("/health", (c) => c.json({ ok: true }));

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
app.route("/families", familyRoutes);
app.route("/members", memberRoutes);
app.route("/tasks", taskRoutes);
app.route("/instances", instanceRoutes);
app.route("/points", pointsRoutes);
app.route("/rewards", rewardRoutes);
app.route("/redemptions", redemptionRoutes);
app.route("/photos", photoRoutes);
app.route("/devices", deviceRoutes);
app.route("/sync", syncRoutes);
app.route("/badges", badgeRoutes);
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
