import type { Env } from "../types";
import { listActiveFamilies } from "../repo/system";
import { generateInstancesForFamily } from "../services/taskEngine";
import { localDate } from "../services/time";

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
    // TODO(iteratie 2): notificatie-scheduler — quiet hours + max 2/dag per kind.
  }
}
