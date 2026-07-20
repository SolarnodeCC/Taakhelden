/**
 * Wachtwoord- en pincode-hashing op WebCrypto (PBKDF2-SHA256).
 * NB: het architectuurdocument noemt Argon2-via-wasm; PBKDF2 is de
 * Workers-native tussenstap (geen wasm-dependency). Het opslagformaat
 * is zelfbeschrijvend zodat een latere Argon2-upgrade oude hashes
 * gewoon kan blijven verifiëren.
 *
 * Formaat: pbkdf2$<iteraties>$<salt b64>$<hash b64>
 */

const ITERATIONS = 100_000; // Workers-limiet voor PBKDF2

function toB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function fromB64(s: string): Uint8Array {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

async function derive(secret: string, salt: Uint8Array, iterations: number): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  return crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations },
    key,
    256,
  );
}

export async function hashSecret(secret: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const bits = await derive(secret, salt, ITERATIONS);
  return `pbkdf2$${ITERATIONS}$${toB64(salt)}$${toB64(bits)}`;
}

export async function verifySecret(secret: string, stored: string): Promise<boolean> {
  const [scheme, iterStr, saltB64, hashB64] = stored.split("$");
  if (scheme !== "pbkdf2" || !iterStr || !saltB64 || !hashB64) return false;
  const bits = await derive(secret, fromB64(saltB64), Number(iterStr));
  const a = new Uint8Array(bits);
  const b = fromB64(hashB64);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

/** SHA-256-hex — voor refresh tokens (hoge entropie, geen KDF nodig). */
export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
