/**
 * APNs + de catalogus van positieve notificatieteksten.
 * Regels: max 2/dag per kind, nooit binnen quiet hours, nooit schuldgevoel-taal.
 * Zie docs/taakhelden-productvoorstel.md §3.7 voor de stijlgids.
 */
export const childCopy = {
  taskOpen: (title: string, points: number) =>
    `${title} wacht op je superkrachten! 💪 (+${points} punten)`,
  almostDayBonus: () => "Nog 1 taakje en je hebt je dagbonus binnen! 🌟",
  weekBonus: () => "WAUW! Weekbonus verdiend — je bent een echte TaakHeld! 🏆",
  redo: (parentName: string) => `Bijna! ${parentName} vraagt of je nog even wil kijken 😉`,
} as const;

// TODO(iteratie 2): APNs JWT (ES256) + HTTP/2 push, quiet-hours check per gezin.
