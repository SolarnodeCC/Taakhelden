/** Exponential reconnect delays in ms (2 s → 4 s → 8 s, capped). */
export const WS_BACKOFF_MS = [2_000, 4_000, 8_000] as const;

export function wsBackoffDelay(attempt: number): number {
  const index = Math.min(attempt, WS_BACKOFF_MS.length - 1);
  return WS_BACKOFF_MS[index];
}
