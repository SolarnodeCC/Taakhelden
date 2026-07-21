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

/**
 * DO-side idempotentie-rijen ouder dan 2 dagen opruimen. De KV-cache verloopt na
 * 24u, dus 48u D1-retentie is een veilige bovengrens; zo blijft de tabel bounded.
 */
export async function purgeOldIdempotencyKeys(db: D1Database) {
  await db
    .prepare("DELETE FROM idempotency_keys WHERE created_at < datetime('now', '-2 days')")
    .run();
}
