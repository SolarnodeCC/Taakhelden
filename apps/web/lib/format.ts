/**
 * Format a signed ledger amount for display.
 *
 * Positive amounts get a `+` prefix; negative amounts (redemptions only)
 * use the Unicode minus sign (U+2212) so screen readers and copy-paste give
 * the correct sign. Redemptions are normal spend — do NOT colour them danger.
 *
 * @example
 *   formatLedgerAmount(50)   // "+50"
 *   formatLedgerAmount(-50)  // "−50"
 */
export function formatLedgerAmount(amount: number): string {
  if (amount >= 0) return `+${amount}`;
  return `\u2212${Math.abs(amount)}`;
}
