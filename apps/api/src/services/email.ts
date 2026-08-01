/**
 * Transactionele e-mail (co-ouder-uitnodiging). Env-guarded net als APNs: zonder
 * EMAIL_API_KEY/EMAIL_FROM is verzenden een stille no-op (dev/test). Best-effort:
 * een mislukte mail mag de uitnodiging nooit blokkeren. Log nooit adres of token.
 */
import type { Env } from "../types";

/**
 * Wachtwoord-reset e-mail. Env-guarded: zonder EMAIL_API_KEY is dit een no-op
 * (dev/test). Log nooit het adres of de reset-token.
 */
export async function sendPasswordResetEmail(
  env: Env,
  email: string,
  resetToken: string,
): Promise<void> {
  if (!env.EMAIL_API_KEY || !env.EMAIL_FROM) {
    // Dev/no-op path — do not log email or token (architectuurregel 5).
    return;
  }

  const link = env.APP_BASE_URL
    ? `${env.APP_BASE_URL}/nl/wachtwoord-reset?token=${resetToken}`
    : null;
  const text = link
    ? `Je hebt een wachtwoordreset aangevraagd voor je Wispel-account. Gebruik deze link om je wachtwoord opnieuw in te stellen: ${link}\n\nDeze link is 1 uur geldig. Als je geen reset hebt aangevraagd, kun je deze e-mail negeren.`
    : `Je hebt een wachtwoordreset aangevraagd voor je Wispel-account. Gebruik deze code in de app: ${resetToken}\n\nDeze code is 1 uur geldig.`;

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.EMAIL_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: email,
        subject: "Wachtwoord opnieuw instellen — Wispel",
        text,
      }),
    });
  } catch {
    // best-effort: de token staat al in KV, de mail is een gemak, geen must
  }
}

export async function sendParentInvite(
  env: Env,
  email: string,
  inviteToken: string,
): Promise<void> {
  if (!env.EMAIL_API_KEY || !env.EMAIL_FROM) return; // geen mail-infra: no-op

  // Locale path so next-intl serves the accept page without a middleware hop.
  // Hardcoded `nl` for Batch 8; invitee locale / Accept-Language can follow later.
  const link = env.APP_BASE_URL
    ? `${env.APP_BASE_URL}/nl/uitnodiging?token=${inviteToken}`
    : null;
  const text = link
    ? `Je bent uitgenodigd als medeverzorger in Wispel. Accepteer je uitnodiging via: ${link}`
    : `Je bent uitgenodigd als medeverzorger in Wispel. Gebruik deze uitnodigingscode in de app: ${inviteToken}`;

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.EMAIL_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: email,
        subject: "Je bent uitgenodigd voor Wispel",
        text,
      }),
    });
  } catch {
    // best-effort: uitnodiging staat al klaar, de mail is een gemak, geen must
  }
}
