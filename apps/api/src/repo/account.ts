/**
 * Account/AVG-repo. Elke functie is family-gescoped (CLAUDE.md regel 1).
 *
 * Twee dingen:
 *  - collectExport: machineleesbare kopie van álle gezinsdata (AVG art. 20).
 *  - soft delete + purge: 7 dagen venster, daarna onherroepelijke cascade
 *    over D1 (AVG art. 17). R2/KV-opschoning gebeurt in services/accountPurge.
 */

/** Alle gezinsdata in één machineleesbaar object (art. 20). */
export async function collectExport(db: D1Database, familyId: string) {
  const q = (sql: string) => db.prepare(sql).bind(familyId).all();
  const [family, members, tasks, instances, ledger, rewards, redemptions, badges, photos] =
    await Promise.all([
      db.prepare("SELECT * FROM families WHERE id = ?").bind(familyId).first(),
      q(`SELECT id, role, permissions, display_name, email, birth_year, age_mode, avatar_id,
                consent_by, consent_at, created_at
         FROM users WHERE family_id = ? AND deleted_at IS NULL`),
      q("SELECT * FROM tasks WHERE family_id = ?"),
      q("SELECT * FROM task_instances WHERE family_id = ?"),
      q("SELECT id, child_id, type, amount, ref_id, note, created_at FROM points_ledger WHERE family_id = ?"),
      q("SELECT * FROM rewards WHERE family_id = ?"),
      q("SELECT * FROM redemptions WHERE family_id = ?"),
      db
        .prepare(
          `SELECT cb.child_id, cb.badge_id, cb.earned_at
           FROM child_badges cb JOIN users u ON u.id = cb.child_id
           WHERE u.family_id = ?`,
        )
        .bind(familyId)
        .all(),
      q("SELECT id, owner_id, purpose, ref_id, content_type, status, created_at FROM photos WHERE family_id = ?"),
    ]);

  return {
    exportedAt: new Date().toISOString(),
    family,
    members: members.results,
    tasks: tasks.results,
    instances: instances.results,
    ledger: ledger.results,
    rewards: rewards.results,
    redemptions: redemptions.results,
    badges: badges.results,
    photos: photos.results,
  };
}

// --- asynchrone data-export (AVG art. 20) ---

/** Nieuwe export-job (status pending). */
export async function createExportJob(db: D1Database, familyId: string, id: string): Promise<void> {
  await db
    .prepare("INSERT INTO account_exports (id, family_id, status) VALUES (?, ?, 'pending')")
    .bind(id, familyId)
    .run();
}

export async function getExportJob(db: D1Database, familyId: string, exportId: string) {
  return db
    .prepare("SELECT * FROM account_exports WHERE family_id = ? AND id = ?")
    .bind(familyId, exportId)
    .first<{ id: string; status: "pending" | "ready" | "failed"; r2_key: string | null }>();
}

export async function setExportReady(
  db: D1Database,
  familyId: string,
  exportId: string,
  r2Key: string,
  byteSize: number,
): Promise<void> {
  await db
    .prepare(
      `UPDATE account_exports SET status = 'ready', r2_key = ?, byte_size = ?, ready_at = datetime('now')
       WHERE family_id = ? AND id = ?`,
    )
    .bind(r2Key, byteSize, familyId, exportId)
    .run();
}

export async function setExportFailed(db: D1Database, familyId: string, exportId: string): Promise<void> {
  await db
    .prepare("UPDATE account_exports SET status = 'failed' WHERE family_id = ? AND id = ?")
    .bind(familyId, exportId)
    .run();
}

/** Klaar-verklaarde foto's mét R2-key — nodig om de bytes in de ZIP te stoppen. */
export async function listReadyPhotosForExport(db: D1Database, familyId: string) {
  const { results } = await db
    .prepare(
      "SELECT id, r2_key, content_type FROM photos WHERE family_id = ? AND status = 'ready'",
    )
    .bind(familyId)
    .all<{ id: string; r2_key: string; content_type: string }>();
  return results;
}

/**
 * Zet het 7-daagse verwijdervenster in: markeer het gezin als verwijderd en trek
 * alle refresh tokens van gezinsleden in. Geeft het gebruikte tijdstip (ISO)
 * terug — bewust ISO 8601 zodat de cron-vergelijking (`deleted_at < cutoff`)
 * lexicografisch klopt.
 */
export async function softDeleteFamily(db: D1Database, familyId: string): Promise<string> {
  const deletedAt = new Date().toISOString();
  await db.batch([
    db
      .prepare("UPDATE families SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL")
      .bind(deletedAt, familyId),
    db
      .prepare(
        `UPDATE refresh_tokens SET revoked_at = ?
         WHERE user_id IN (SELECT id FROM users WHERE family_id = ?) AND revoked_at IS NULL`,
      )
      .bind(deletedAt, familyId),
  ]);
  return deletedAt;
}

/** Gezinnen waarvan het soft-delete-venster verstreken is (voor de purge-cron). */
export async function listExpiredFamilies(db: D1Database, cutoffIso: string): Promise<string[]> {
  const { results } = await db
    .prepare("SELECT id FROM families WHERE deleted_at IS NOT NULL AND deleted_at < ?")
    .bind(cutoffIso)
    .all();
  return results.map((r) => r.id as string);
}

/** Alle user-id's van een gezin (incl. soft-deleted) — nodig voor KV-opschoning. */
export async function familyUserIds(db: D1Database, familyId: string): Promise<string[]> {
  const { results } = await db
    .prepare("SELECT id FROM users WHERE family_id = ?")
    .bind(familyId)
    .all();
  return results.map((r) => r.id as string);
}

/**
 * Onherroepelijke D1-cascade voor één gezin, in FK-veilige volgorde binnen één
 * batch (atomair). consent_by wordt eerst genulld zodat de self-reference in
 * users bij het verwijderen niet in de weg zit.
 */
export async function purgeFamilyD1(db: D1Database, familyId: string): Promise<void> {
  const scoped = (sql: string) => db.prepare(sql).bind(familyId);
  const childScope = "child_id IN (SELECT id FROM users WHERE family_id = ?)";
  const userScope = "user_id IN (SELECT id FROM users WHERE family_id = ?)";
  await db.batch([
    scoped("UPDATE users SET consent_by = NULL WHERE family_id = ?"),
    scoped(`DELETE FROM child_badges WHERE ${childScope}`),
    scoped(`DELETE FROM pinned_rewards WHERE ${childScope}`),
    scoped(`DELETE FROM refresh_tokens WHERE ${userScope}`),
    scoped(`DELETE FROM devices WHERE ${userScope}`),
    scoped(`DELETE FROM idempotency_keys WHERE ${userScope}`),
    scoped("DELETE FROM account_exports WHERE family_id = ?"),
    scoped("DELETE FROM photos WHERE family_id = ?"),
    scoped("DELETE FROM redemptions WHERE family_id = ?"),
    scoped("DELETE FROM points_ledger WHERE family_id = ?"),
    scoped("DELETE FROM task_instances WHERE family_id = ?"),
    scoped("DELETE FROM rewards WHERE family_id = ?"),
    scoped("DELETE FROM tasks WHERE family_id = ?"),
    scoped("DELETE FROM users WHERE family_id = ?"),
    db.prepare("DELETE FROM families WHERE id = ?").bind(familyId),
  ]);
}
