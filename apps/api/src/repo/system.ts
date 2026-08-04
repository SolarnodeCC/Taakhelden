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

/**
 * Gecachte DO-mutatieresponse voor `{userId}:{idempotencyKey}` — of null.
 *
 * `fingerprint` legt vast vóór wélke operatie de sleutel is gebruikt, zodat de
 * aanroeper een echte retry kan onderscheiden van hergebruik voor iets anders.
 * NULL bij rijen van vóór migratie 0010.
 */
export async function getIdempotencyRecord(
  db: D1Database,
  storeKey: string,
): Promise<{ response: string; fingerprint: string | null } | null> {
  const cached = await db
    .prepare("SELECT response, fingerprint FROM idempotency_keys WHERE key = ?")
    .bind(storeKey)
    .first<{ response: string; fingerprint: string | null }>();
  return cached ?? null;
}

/**
 * Slaat een succesvolle DO-mutatieresponse op. INSERT OR IGNORE: bij race
 * wint de eerste write; de caller herleest daarna indien nodig.
 */
export async function storeIdempotencyResponse(
  db: D1Database,
  storeKey: string,
  userId: string,
  responseJson: string,
  fingerprint: string,
): Promise<void> {
  await db
    .prepare(
      "INSERT OR IGNORE INTO idempotency_keys (key, user_id, response, fingerprint) VALUES (?, ?, ?, ?)",
    )
    .bind(storeKey, userId, responseJson, fingerprint)
    .run();
}
