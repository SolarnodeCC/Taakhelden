import type { Env } from "../types";
import { listActiveFamilies, purgeOldIdempotencyKeys } from "../repo/system";
import { generateWeekAheadForFamily } from "../services/taskEngine";
import { purgeExpiredAccounts } from "../services/accountPurge";
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
      // Hele resterende week vooruit: weektotaal is compleet, dus de weekbonus
      // kan elke dag vallen zodra de drempel gehaald is.
      await generateWeekAheadForFamily(
        env.DB,
        family.id as string,
        family as { vacation_mode?: unknown },
        date,
      );
    }
    // AVG art. 17: gezinnen voorbij het 7-daagse soft-delete-venster opschonen.
    await purgeExpiredAccounts(env);
    // Idempotentie-rijen (DO-side dedup) ouder dan 48u opruimen.
    await purgeOldIdempotencyKeys(env.DB);
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
