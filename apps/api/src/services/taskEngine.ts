/**
 * taskEngine: recurrence rules → TaskInstances van een dag.
 * Idempotent (INSERT OR IGNORE op UNIQUE(task_id, child_id, date)), dus de
 * cron mag gerust vaker draaien. Roulatie wisselt per ISO-week.
 */
import { newId } from "./ids";
import { weekdayCode, isoWeekNumber } from "./time";
import { listActiveTasksForDate } from "../repo/tasks";
import { insertInstance } from "../repo/instances";

interface RecurrenceRule {
  freq: "daily" | "weekly";
  days?: string[];
}

function taskRunsOnDate(task: Record<string, unknown>, date: string): boolean {
  const raw = task.recurrence as string | null;
  if (!raw) {
    // Eenmalige taak: verschijnt op zijn activeFrom-dag (door createTask altijd gezet).
    return task.active_from === date;
  }
  const rule = JSON.parse(raw) as RecurrenceRule;
  if (rule.freq === "daily") return true;
  return (rule.days ?? []).includes(weekdayCode(date));
}

function assigneesForDate(task: Record<string, unknown>, date: string): string[] {
  const rotation = task.rotation ? (JSON.parse(task.rotation as string) as string[]) : null;
  if (rotation && rotation.length > 0) {
    // Wekelijkse roulatie: één kind per week, beurt schuift per ISO-week.
    const child = rotation[isoWeekNumber(date) % rotation.length];
    return child ? [child] : [];
  }
  return JSON.parse((task.assignees as string) ?? "[]") as string[];
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
  for (const task of tasks) {
    if (!taskRunsOnDate(task as Record<string, unknown>, date)) continue;
    for (const childId of assigneesForDate(task as Record<string, unknown>, date)) {
      await insertInstance(db, familyId, {
        id: newId("ti"),
        taskId: task.id as string,
        childId,
        date,
      });
      created++;
    }
  }
  return created;
}
