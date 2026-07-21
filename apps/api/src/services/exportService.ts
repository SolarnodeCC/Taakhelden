/**
 * Data-export (AVG art. 20): R2-key en kortlevende, HMAC-gesigneerde
 * downloadlink. Zelfde aanpak als de foto-transfer (services/photoService):
 * de Worker serveert het ZIP-bestand zelf en autoriseert met een handtekening
 * in de URL, zodat de bucket nooit publiek hoeft te zijn.
 */

export const EXPORT_DOWNLOAD_TTL_SECONDS = 10 * 60;

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

/** R2-key voor het ZIP-bestand van een export-job. */
export function exportKey(familyId: string, exportId: string): string {
  return `export/${familyId}/${exportId}.zip`;
}

export async function signExportDownload(
  secret: string,
  familyId: string,
  exportId: string,
  ttlSeconds: number = EXPORT_DOWNLOAD_TTL_SECONDS,
): Promise<{ exp: number; sig: string }> {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  return { exp, sig: await hmacHex(secret, `export:${familyId}:${exportId}:${exp}`) };
}

export async function verifyExportDownload(
  secret: string,
  familyId: string | undefined,
  exportId: string,
  exp: string | undefined,
  sig: string | undefined,
): Promise<boolean> {
  if (!familyId || !exp || !sig || !/^\d+$/.test(exp)) return false;
  if (Number(exp) < Math.floor(Date.now() / 1000)) return false;
  const expected = await hmacHex(secret, `export:${familyId}:${exportId}:${exp}`);
  if (sig.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

export function exportDownloadUrl(
  origin: string,
  familyId: string,
  exportId: string,
  exp: number,
  sig: string,
): string {
  return `${origin}/v1/account/export/${exportId}/file?fam=${familyId}&exp=${exp}&sig=${sig}`;
}
