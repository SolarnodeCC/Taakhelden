import { Hono } from "hono";
import type { AppBindings } from "./types";
import { errorHandler } from "./middleware/error";
import { authMiddleware } from "./middleware/auth";
import authRoutes from "./routes/auth";
import familyRoutes from "./routes/families";
import taskRoutes from "./routes/tasks";
import instanceRoutes from "./routes/instances";

const app = new Hono<AppBindings>().basePath("/v1");

app.onError(errorHandler);
app.get("/health", (c) => c.json({ ok: true }));

// Publiek (eigen rate limits + Turnstile in de handlers)
app.route("/auth", authRoutes);

// Alles hieronder vereist een geldige JWT
app.use("*", authMiddleware);
app.route("/families", familyRoutes);
app.route("/tasks", taskRoutes);
app.route("/instances", instanceRoutes);
// TODO volgende iteraties: /photos /points /rewards /devices /sync /account

export default {
  fetch: app.fetch,
  scheduled: async (event: ScheduledEvent, env: any, ctx: ExecutionContext) => {
    const { runCron } = await import("./jobs/cron");
    ctx.waitUntil(runCron(event.cron, env));
  },
  queue: async (batch: MessageBatch, env: any) => {
    const { processPhotos } = await import("./jobs/photoConsumer");
    await processPhotos(batch, env);
  },
};

export { FamilyRoom } from "./do/FamilyRoom";
