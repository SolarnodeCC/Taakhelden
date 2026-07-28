/**
 * taskEngine: recurrence rules → TaskInstances van een dag.
 * Idempotent (INSERT OR IGNORE op UNIQUE(task_id, child_id, date)), dus de
 * cron mag gerust vaker draaien. Roulatie wisselt per ISO-week.
 */
import { z } from "zod";
import { Recurrence } from "@taakhelden/shared";
import { newId } from "./ids";
import { weekdayCode, isoWeekNumber, weekDates } from "./time";
import { listActiveTasksForDate } from "../repo/tasks";
import { insertInstance } from "../repo/instances";
import { parseJsonColumn } from "./jsonParse";

const StringIdList = z.array(z.string().min(1));

function taskRunsOnDate(task: Record<string, unknown>, date: string): boolean {
  const raw = typeof task.recurrence === "string" ? task.recurrence : null;
  if (!raw) {
    // Eenmalige taak: verschijnt op zijn activeFrom-dag (door createTask altijd gezet).
    return task.active_from === date;
  }
  const rule = parseJsonColumn(raw, Recurrence, null);
  if (!rule) return false;
  if (rule.freq === "daily") return true;
  return (rule.days ?? []).includes(weekdayCode(date));
}

function assigneesForDate(task: Record<string, unknown>, date: string): string[] {
  const rotation = parseJsonColumn(task.rotation, StringIdList, []);
  if (rotation.length > 0) {
    // Wekelijkse roulatie: één kind per week, beurt schuift per ISO-week.
    const child = rotation[isoWeekNumber(date) % rotation.length];
    return child ? [child] : [];
  }
  return parseJsonColumn(task.assignees, StringIdList, []);
}

function asTaskRow(task: unknown): Record<string, unknown> | null {
  if (!task || typeof task !== "object") return null;
  return task as Record<string, unknown>;
}

function taskIdOf(task: Record<string, unknown>): string | null {
  return typeof task.id === "string" ? task.id : null;
}

/** Genereer alle instances van `date` voor één gezin. Respecteert vacation_mode. */
export async function generateInstancesForFamily(
  db: D1Database,
  familyId: string,
  family: { vacation_mode?: unknown },
  date: string,
): Promise<number> {
  if (family.vacation_mode) return 0;
  const tasks = await listActiveTasksForDate(db, familyId, date);
  let created = 0;
  for (const taskRaw of tasks) {
    const task = asTaskRow(taskRaw);
    if (!task || !taskRunsOnDate(task, date)) continue;
    const taskId = taskIdOf(task);
    if (!taskId) continue;
    for (const childId of assigneesForDate(task, date)) {
      await insertInstance(db, familyId, {
        id: newId("ti"),
        taskId,
        childId,
        date,
      });
      created++;
    }
  }
  return created;
}

/**
 * Genereert vanaf `fromDate` t/m het einde van diens ISO-week. Zo staat het
 * weektotaal er vroeg, waardoor de weekbonus elke dag kan vallen (niet meer
 * alleen op zondag). INSERT OR IGNORE houdt het idempotent bij herhaalde runs.
 */
export async function generateWeekAheadForFamily(
  db: D1Database,
  familyId: string,
  family: { vacation_mode?: unknown },
  fromDate: string,
): Promise<number> {
  let created = 0;
  for (const date of weekDates(fromDate)) {
    if (date < fromDate) continue; // alleen vandaag + de resterende week
    created += await generateInstancesForFamily(db, familyId, family, date);
  }
  return created;
}
