/**
 * Cloudflare Turnstile-verificatie (registratie/login).
 * Zonder geconfigureerd secret (lokaal/tests) wordt de check overgeslagen.
 */
export async function verifyTurnstile(secret: string | undefined, token: string, ip?: string): Promise<boolean> {
  if (!secret) return true; // dev/test: geen Turnstile geconfigureerd
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret, response: token, remoteip: ip }),
  });
  if (!res.ok) return false;
  const data = (await res.json()) as { success: boolean };
  return data.success;
}
