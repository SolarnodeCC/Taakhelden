import { Hono } from "hono";
import type { AppBindings, Env } from "./types";
import { errorHandler } from "./middleware/error";
import { authMiddleware } from "./middleware/auth";
import authRoutes from "./routes/auth";
import familyRoutes from "./routes/families";
import memberRoutes from "./routes/members";
import taskRoutes from "./routes/tasks";
import instanceRoutes from "./routes/instances";
import pointsRoutes from "./routes/points";
import rewardRoutes from "./routes/rewards";
import redemptionRoutes from "./routes/redemptions";

const app = new Hono<AppBindings>().basePath("/v1");

app.onError(errorHandler);
app.get("/health", (c) => c.json({ ok: true }));

// Publiek (eigen rate limits + Turnstile in de handlers)
app.route("/auth", authRoutes);

// Alles hieronder vereist een geldige JWT
app.use("*", authMiddleware);
app.route("/families", familyRoutes);
app.route("/members", memberRoutes);
app.route("/tasks", taskRoutes);
app.route("/instances", instanceRoutes);
app.route("/points", pointsRoutes);
app.route("/rewards", rewardRoutes);
app.route("/redemptions", redemptionRoutes);
// TODO volgende iteraties: /photos /devices /sync /account /ws

export default {
  fetch: app.fetch,
  scheduled: async (event: ScheduledEvent, env: Env, ctx: ExecutionContext) => {
    const { runCron } = await import("./jobs/cron");
    ctx.waitUntil(runCron(event.cron, env));
  },
  queue: async (batch: MessageBatch, env: Env) => {
    const { processPhotos } = await import("./jobs/photoConsumer");
    await processPhotos(batch, env);
  },
};

export { FamilyRoom } from "./do/FamilyRoom";
