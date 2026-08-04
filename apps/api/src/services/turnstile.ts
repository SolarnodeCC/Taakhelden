/**
 * Cloudflare Turnstile-verificatie (registratie).
 *
 * Faalt DICHT. Eerder gaf een ontbrekend secret stilzwijgend `true` terug —
 * "dit is een mens" — waardoor de bot-bescherming verdween zodra iemand vergat
 * het secret te zetten, zonder enig signaal in logs of health-check.
 *
 * Lokaal en in tests zet je de check expliciet uit met TURNSTILE_DEV_BYPASS="true".
 * Die vlag staat niet in wrangler.toml en wordt niet door de deploy gezet, dus
 * productie kan er niet per ongeluk in vallen.
 */
import type { Env } from "../types";

export type TurnstileEnv = Pick<Env, "TURNSTILE_SECRET" | "TURNSTILE_DEV_BYPASS">;

export async function verifyTurnstile(
  env: TurnstileEnv,
  token: string,
  ip?: string,
): Promise<boolean> {
  if (env.TURNSTILE_DEV_BYPASS === "true") return true;
  if (!env.TURNSTILE_SECRET) {
    // Configuratiefout, geen clientfout: 500 via de error-middleware, zodat dit
    // opvalt in plaats van stilletjes de beveiliging uit te zetten.
    throw new Error("TURNSTILE_SECRET is not configured");
  }
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret: env.TURNSTILE_SECRET, response: token, remoteip: ip }),
  });
  if (!res.ok) return false;
  const data = (await res.json()) as { success: boolean };
  return data.success;
}
