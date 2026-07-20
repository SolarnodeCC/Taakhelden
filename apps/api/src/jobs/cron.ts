export async function runCron(cron: string, env: unknown) {
  if (cron === "5 0 * * *") {
    // TODO: taskEngine — TaskInstances van vandaag genereren uit recurrence rules,
    // per gezins-tijdzone; roulatie toepassen; vacation_mode respecteren.
  }
  if (cron === "*/15 * * * *") {
    // TODO: notificatie-scheduler — quiet hours + max 2/dag per kind afdwingen.
  }
}
