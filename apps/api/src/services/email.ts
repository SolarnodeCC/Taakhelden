/**
 * Transactionele e-mail (co-ouder-uitnodiging). Env-guarded net als APNs: zonder
 * EMAIL_API_KEY/EMAIL_FROM is verzenden een stille no-op (dev/test). Best-effort:
 * een mislukte mail mag de uitnodiging nooit blokkeren. Log nooit adres of token.
 */
import type { Env } from "../types";

export async function sendParentInvite(
  env: Env,
  email: string,
  inviteToken: string,
): Promise<void> {
  if (!env.EMAIL_API_KEY || !env.EMAIL_FROM) return; // geen mail-infra: no-op

  const link = env.APP_BASE_URL
    ? `${env.APP_BASE_URL}/uitnodiging?token=${inviteToken}`
    : null;
  const text = link
    ? `Je bent uitgenodigd als medeverzorger in TaakHelden. Accepteer je uitnodiging via: ${link}`
    : `Je bent uitgenodigd als medeverzorger in TaakHelden. Gebruik deze uitnodigingscode in de app: ${inviteToken}`;

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
        subject: "Je bent uitgenodigd voor TaakHelden",
        text,
      }),
    });
  } catch {
    // best-effort: uitnodiging staat al klaar, de mail is een gemak, geen must
  }
}
