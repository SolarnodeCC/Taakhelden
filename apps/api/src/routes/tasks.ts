import { Hono } from "hono";
import { TaskBody, TaskPatchBody, ErrorCodes } from "@taakhelden/shared";
import type { AppBindings } from "../types";
import { ApiException } from "../middleware/error";
import { requireParent } from "../middleware/authz";
import { validate } from "../middleware/validate";
import { listTasks, getTask, createTask, updateTask, archiveTask } from "../repo/tasks";
import { getFamily } from "../repo/families";
import { generateInstancesForFamily } from "../services/taskEngine";
import { localDate } from "../services/time";

const tasks = new Hono<AppBindings>();

function taskView(row: Record<string, unknown>) {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    icon: row.icon,
    points: row.points,
    photoBonusPoints: row.photo_bonus_points,
    approvalRequired: Boolean(row.approval_required),
    assignees: JSON.parse((row.assignees as string) ?? "[]"),
    rotation: row.rotation ? JSON.parse(row.rotation as string) : null,
    recurrence: row.recurrence ? JSON.parse(row.recurrence as string) : null,
    daypart: row.daypart ?? null,
    activeFrom: row.active_from ?? null,
    activeUntil: row.active_until ?? null,
  };
}

tasks.get("/", async (c) => {
  const { familyId } = requireParent(c);
  const rows = await listTasks(c.env.DB, familyId);
  return c.json(rows.results.map((r) => taskView(r as Record<string, unknown>)));
});

tasks.post("/", validate("json", TaskBody), async (c) => {
  const { familyId } = requireParent(c, { full: true });
  const body = c.req.valid("json");

  const family = await getFamily(c.env.DB, familyId);
  const today = localDate((family?.timezone as string) ?? "Europe/Amsterdam");
  // activeFrom default = vandaag, zodat eenmalige taken meteen een dag hebben.
  const id = await createTask(c.env.DB, familyId, { ...body, activeFrom: body.activeFrom ?? today });

  // Vandaag al aan de beurt? Dan meteen instances aanmaken — niet wachten op de nachtelijke cron.
  await generateInstancesForFamily(c.env.DB, familyId, family as { vacation_mode?: unknown }, today);

  const row = await getTask(c.env.DB, familyId, id);
  return c.json(taskView(row as Record<string, unknown>), 201);
});

tasks.patch("/:id", validate("json", TaskPatchBody), async (c) => {
  const { familyId } = requireParent(c, { full: true });
  const taskId = c.req.param("id");
  const existing = await getTask(c.env.DB, familyId, taskId);
  if (!existing || existing.archived_at) {
    throw new ApiException(404, ErrorCodes.NOT_FOUND, "Taak niet gevonden.");
  }
  // Werkt alleen door op toekomstige instances; bestaande punten blijven staan.
  await updateTask(c.env.DB, familyId, taskId, c.req.valid("json"));
  const row = await getTask(c.env.DB, familyId, taskId);
  return c.json(taskView(row as Record<string, unknown>));
});

tasks.delete("/:id", async (c) => {
  const { familyId } = requireParent(c, { full: true });
  const taskId = c.req.param("id");
  const existing = await getTask(c.env.DB, familyId, taskId);
  if (!existing) {
    throw new ApiException(404, ErrorCodes.NOT_FOUND, "Taak niet gevonden.");
  }
  await archiveTask(c.env.DB, familyId, taskId); // archiveren: historie blijft intact
  return c.json({ ok: true });
});

/** Leeftijdstemplates — statische catalogus; één tik "toevoegen aan gezin". */
const TEMPLATES: Array<{ minAge: number; maxAge: number; template: Partial<TaskBody> & { title: string } }> = [
  { minAge: 4, maxAge: 7, template: { title: "Speelgoed opruimen", category: "household", icon: "toys", points: 10 } },
  { minAge: 4, maxAge: 7, template: { title: "Tanden poetsen", category: "selfcare", icon: "tooth", points: 5, recurrence: { freq: "daily" } } },
  { minAge: 4, maxAge: 12, template: { title: "Tafel dekken", category: "household", icon: "table", points: 10 } },
  { minAge: 6, maxAge: 12, template: { title: "Leesboek lezen (15 min)", category: "homework", icon: "book", points: 15 } },
  { minAge: 8, maxAge: 13, template: { title: "Vaatwasser uitruimen", category: "household", icon: "dishwasher", points: 15 } },
  { minAge: 8, maxAge: 18, template: { title: "Huiswerk maken", category: "homework", icon: "pencil", points: 20, recurrence: { freq: "weekly", days: ["MO", "TU", "WE", "TH"] } } },
  { minAge: 10, maxAge: 18, template: { title: "Kamer stofzuigen", category: "household", icon: "vacuum", points: 20 } },
  { minAge: 12, maxAge: 18, template: { title: "Afval buiten zetten", category: "household", icon: "trash", points: 10 } },
];

tasks.get("/templates", async (c) => {
  requireParent(c);
  const age = Number(c.req.query("age") ?? 8);
  const templates = TEMPLATES.filter((t) => age >= t.minAge && age <= t.maxAge).map((t) => t.template);
  return c.json({ age, templates });
});

export default tasks;
