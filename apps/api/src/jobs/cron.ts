import type { Env } from "../types";
import { listActiveFamilies } from "../repo/system";
import { generateInstancesForFamily } from "../services/taskEngine";
import { listOpenForDate } from "../repo/instances";
import { notifyChild, childCopy } from "../services/notifier";
import { localDate, localTime } from "../services/time";

export async function runCron(cron: string, env: Env) {
  if (cron === "5 0 * * *") {
    // Dagelijkse instance-generatie. We genereren per gezin voor de datum die
    // het dáár nu is (gezins-tijdzone); INSERT OR IGNORE maakt herhaling veilig.
    const families = await listActiveFamilies(env.DB);
    for (const family of families) {
      const date = localDate((family.timezone as string) ?? "Europe/Amsterdam");
      await generateInstancesForFamily(
        env.DB,
        family.id as string,
        family as { vacation_mode?: unknown },
        date,
      );
    }
  }
  if (cron === "*/15 * * * *") {
    // Vriendelijke taakherinnering rond 16:00 lokale tijd (één cron-tick per dag
    // per gezin). notifyChild bewaakt zelf quiet hours én max 2 pushes per dag.
    const families = await listActiveFamilies(env.DB);
    for (const family of families) {
      if (family.vacation_mode) continue;
      const tz = (family.timezone as string) ?? "Europe/Amsterdam";
      const hhmm = localTime(tz);
      if (hhmm < "16:00" || hhmm >= "16:15") continue;

      const open = await listOpenForDate(env.DB, family.id as string, localDate(tz));
      const reminded = new Set<string>();
      for (const row of open) {
        if (reminded.has(row.child_id)) continue; // één herinnering per kind
        reminded.add(row.child_id);
        await notifyChild(env, family.id as string, row.child_id, childCopy.taskOpen(row.title, row.points));
      }
    }
  }
}
