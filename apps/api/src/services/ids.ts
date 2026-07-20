const alphabet = "abcdefghjkmnpqrstuvwxyz23456789"; // geen verwarrende tekens

export function newId(prefix: string): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let s = "";
  for (const b of bytes) s += alphabet[b % alphabet.length];
  return `${prefix}_${s}`;
}

export function newFamilyCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  let s = "";
  for (const b of bytes) s += alphabet[b % alphabet.length];
  return s.toUpperCase();
}
