/**
 * ENIGE laag met SQL voor kind-pauzes (WS-PAUSE / Rustschild).
 * familyId is het eerste argument — security-grens.
 * Pauzes raken het ledger NOOIT (architectuurregel 4).
 */
import { newId } from "../services/ids";

export interface PauseRow {
  id: string;
  family_id: string;
  child_id: string;
  starts_on: string;
  ends_on: string | null;
  reason: string | null;
  created_by: string;
  created_at: string;
  cleared_at: string | null;
}

/** Is er op `onDate` een actieve pauze voor dit kind? */
export async function activePauseFor(
  db: D1Database,
  familyId: string,
  childId: string,
  onDate: string,
): Promise<PauseRow | null> {
  return db
    .prepare(
      `SELECT * FROM child_pauses
       WHERE family_id = ? AND child_id = ?
         AND starts_on <= ? AND (ends_on IS NULL OR ends_on >= ?)
         AND cleared_at IS NULL
       ORDER BY starts_on DESC
       LIMIT 1`,
    )
    .bind(familyId, childId, onDate, onDate)
    .first<PauseRow>();
}

/** Alle actieve en toekomstige pauzes voor een kind (nog niet cleared). */
export async function listPauses(
  db: D1Database,
  familyId: string,
  childId: string,
): Promise<PauseRow[]> {
  const { results } = await db
    .prepare(
      `SELECT * FROM child_pauses
       WHERE family_id = ? AND child_id = ? AND cleared_at IS NULL
       ORDER BY starts_on DESC`,
    )
    .bind(familyId, childId)
    .all<PauseRow>();
  return results;
}

/**
 * Stel een pauze in voor een kind, of werk een bestaande actieve pauze met dezelfde
 * startdatum bij. De upsert matcht de partiële unique index uit migratie 0011
 * (`family_id, child_id, starts_on` waar `cleared_at IS NULL`), zodat een ouder die
 * dezelfde pauze opnieuw instelt — bijvoorbeeld om de einddatum te verlengen — geen
 * UNIQUE-fout krijgt. `RETURNING id` levert altijd de id van de rij die nu geldt.
 */
export async function setPause(
  db: D1Database,
  familyId: string,
  input: {
    childId: string;
    startsOn: string;
    endsOn: string | null;
    reason: string | null;
    createdBy: string;
  },
): Promise<string> {
  const row = await db
    .prepare(
      `INSERT INTO child_pauses (id, family_id, child_id, starts_on, ends_on, reason, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (family_id, child_id, starts_on) WHERE cleared_at IS NULL
       DO UPDATE SET ends_on = excluded.ends_on,
                     reason = excluded.reason,
                     created_by = excluded.created_by
       RETURNING id`,
    )
    .bind(
      newId("pz"),
      familyId,
      input.childId,
      input.startsOn,
      input.endsOn,
      input.reason,
      input.createdBy,
    )
    .first<{ id: string }>();
  if (!row) {
    throw new Error("setPause: no row returned");
  }
  return row.id;
}

/**
 * Sluit een pauze af (cleared_at zetten). Scoped op `childId` zodat de pauze van een
 * ander kind niet via de URL van dit kind beëindigd kan worden.
 * Geeft terug of er daadwerkelijk iets gewijzigd is.
 */
export async function clearPause(
  db: D1Database,
  familyId: string,
  childId: string,
  pauseId: string,
): Promise<boolean> {
  const res = await db
    .prepare(
      `UPDATE child_pauses
       SET cleared_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
       WHERE family_id = ? AND child_id = ? AND id = ? AND cleared_at IS NULL`,
    )
    .bind(familyId, childId, pauseId)
    .run();
  return (res.meta.changes ?? 0) > 0;
}

/**
 * Set van child_id's die op `date` gepauzeerd zijn.
 * Wordt gebruikt door taskEngine om instance-generatie over te slaan.
 */
export async function activePausedChildIds(
  db: D1Database,
  familyId: string,
  date: string,
): Promise<Set<string>> {
  const { results } = await db
    .prepare(
      `SELECT child_id FROM child_pauses
       WHERE family_id = ? AND starts_on <= ? AND (ends_on IS NULL OR ends_on >= ?) AND cleared_at IS NULL`,
    )
    .bind(familyId, date, date)
    .all<{ child_id: string }>();
  return new Set(results.map((r) => r.child_id));
}

/**
 * Alle actieve (niet-cleared) pauzes voor een kind.
 * Wordt gebruikt door pointsEngine voor streak-berekening met pausedDates.
 */
export async function listActivePausesFor(
  db: D1Database,
  familyId: string,
  childId: string,
): Promise<Array<{ starts_on: string; ends_on: string | null }>> {
  const { results } = await db
    .prepare(
      `SELECT starts_on, ends_on FROM child_pauses
       WHERE family_id = ? AND child_id = ? AND cleared_at IS NULL
       ORDER BY starts_on`,
    )
    .bind(familyId, childId)
    .all<{ starts_on: string; ends_on: string | null }>();
  return results;
}
