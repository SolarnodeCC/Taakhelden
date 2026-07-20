/**
 * Puntenlogica — draait ALTIJD binnen de FamilyRoom-DO (serialisatie per gezin).
 * Regels (zie CLAUDE.md):
 *  - saldo = som van points_ledger, nooit een los veld
 *  - dag/weekbonus transactioneel bij de laatste kwalificerende complete
 *  - nooit negatief behalve redemption
 */
import type { CompleteResult } from "@taakhelden/shared";

export interface CompleteInput {
  familyId: string;
  childId: string;
  instanceId: string;
  taskPoints: number;
  photoBonus: number;
}

// TODO(iteratie 2): implementatie — task-punten boeken, dagcompletie checken,
// weekvoortgang vs threshold, streak bijwerken, badges evalueren.
export async function applyComplete(_db: D1Database, _input: CompleteInput): Promise<CompleteResult> {
  throw new Error("not implemented");
}
