/**
 * Badge-toekenning: alleen positieve mijlpalen (productvoorstel §gamification).
 *
 * De regels leven hier (gekoppeld aan een badge-id); de weergavegegevens
 * (titel/omschrijving/icoon) staan in de `badges`-tabel, geseed in migratie
 * 0002. Houd de id's van beide in sync.
 *
 * Toekenning gebeurt in dezelfde (DO-geserialiseerde) transactie als
 * complete/bonus, zodat de verdiende badge in de confetti-response meekomt.
 */

/** Momentopname van het kind waartegen de regels worden geëvalueerd. */
export interface BadgeStats {
  taskCount: number; // aantal geboekte 'task'-ledgerregels
  homeworkCount: number; // goedgekeurde huiswerk-instances
  weekBonusCount: number; // aantal verdiende weekbonussen
  streakDays: number; // huidige dagbonus-streak
  balance: number; // actueel saldo
}

const BADGE_RULES: Record<string, (s: BadgeStats) => boolean> = {
  first_task: (s) => s.taskCount >= 1,
  ten_tasks: (s) => s.taskCount >= 10,
  streak_5: (s) => s.streakDays >= 5,
  first_week: (s) => s.weekBonusCount >= 1,
  homework_hero: (s) => s.homeworkCount >= 10,
  saver_250: (s) => s.balance >= 250,
};

/** Id's van alle badges waarvoor het kind nu kwalificeert (ook al verdiende). */
export function qualifyingBadgeIds(stats: BadgeStats): string[] {
  return Object.entries(BADGE_RULES)
    .filter(([, qualifies]) => qualifies(stats))
    .map(([id]) => id);
}
