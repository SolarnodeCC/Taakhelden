/**
 * Systeem-repo: alleen voor jobs (cron/queue), NIET voor routes.
 * Dit is de enige plek die over gezinnen heen mag itereren; elke
 * vervolg-query gaat daarna alsnog per familyId door de normale repo's.
 */
export async function listActiveFamilies(db: D1Database) {
  const { results } = await db
    .prepare("SELECT * FROM families WHERE deleted_at IS NULL")
    .all();
  return results;
}
