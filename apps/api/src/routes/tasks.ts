import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { TaskBody } from "@taakhelden/shared";
import type { AppBindings } from "../types";
import { requireParent } from "../middleware/authz";
import { listTasks, createTask } from "../repo/tasks";

const tasks = new Hono<AppBindings>();

tasks.get("/", async (c) => {
  requireParent(c);
  const { familyId } = c.get("auth");
  const rows = await listTasks(c.env.DB, familyId);
  return c.json(rows.results);
});

tasks.post("/", zValidator("json", TaskBody), async (c) => {
  requireParent(c, { full: true });
  const { familyId } = c.get("auth");
  const id = await createTask(c.env.DB, familyId, c.req.valid("json"));
  return c.json({ id }, 201);
});

tasks.get("/templates", async (c) => {
  requireParent(c);
  const age = Number(c.req.query("age") ?? 8);
  // TODO: templates uit KV-cache; voorlopig statisch
  return c.json({ age, templates: [] });
});

export default tasks;
