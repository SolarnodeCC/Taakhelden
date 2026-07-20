/**
 * Signed upload/download-URLs voor foto's. R2-bindings kunnen zelf geen
 * presigned URLs maken (daar zijn S3-credentials voor nodig die we bewust
 * niet beheren), dus de Worker serveert de PUT/GET zelf en autoriseert met
 * een kortlevende HMAC-handtekening in de URL — functioneel gelijk aan de
 * presigned-flow uit spec §3.6: de app PUT't binnen 5 minuten rechtstreeks.
 */

export const UPLOAD_URL_TTL_SECONDS = 5 * 60;
export const DOWNLOAD_URL_TTL_SECONDS = 5 * 60;

const enc = new TextEncoder();

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function signPhotoTransfer(
  secret: string,
  familyId: string,
  photoId: string,
  verb: "put" | "get",
  ttlSeconds: number,
): Promise<{ exp: number; sig: string }> {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  return { exp, sig: await hmacHex(secret, `photo:${familyId}:${photoId}:${verb}:${exp}`) };
}

export async function verifyPhotoTransfer(
  secret: string,
  familyId: string | undefined,
  photoId: string,
  verb: "put" | "get",
  exp: string | undefined,
  sig: string | undefined,
): Promise<boolean> {
  if (!familyId || !exp || !sig || !/^\d+$/.test(exp)) return false;
  if (Number(exp) < Math.floor(Date.now() / 1000)) return false;
  const expected = await hmacHex(secret, `photo:${familyId}:${photoId}:${verb}:${exp}`);
  // Constante-tijd vergelijking van gelijke-lengte hexstrings.
  if (sig.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

/** R2-key: taakfoto's onder task/ (30 d lifecycle), profielfoto's uitgezonderd. */
export function photoKey(purpose: "task" | "profile", familyId: string, photoId: string): string {
  return `${purpose}/${familyId}/${photoId}`;
}

export function transferUrl(
  origin: string,
  familyId: string,
  photoId: string,
  verb: "put" | "get",
  exp: number,
  sig: string,
): string {
  const path = verb === "put" ? "upload" : "file";
  return `${origin}/v1/photos/${photoId}/${path}?fam=${familyId}&exp=${exp}&sig=${sig}`;
}
