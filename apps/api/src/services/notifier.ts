/**
 * APNs-push + de catalogus van positieve notificatieteksten.
 * Regels: max 2/dag per kind, nooit binnen quiet hours, nooit schuldgevoel-taal
 * (stijlgids: docs/taakhelden-productvoorstel.md §3.7). Zonder APNS-secrets
 * (lokaal/test) is verzenden een stille no-op. Log nooit namen of tokens.
 */
import { SignJWT, importPKCS8 } from "jose";
import type { Env } from "../types";
import { getFamily, getMembers, getMember } from "../repo/families";
import { listDeviceTokensForUsers, deleteDeadDeviceToken } from "../repo/devices";
import { localDate, localTime } from "./time";

export const childCopy = {
  taskOpen: (title: string, points: number) =>
    `${title} wacht op je superkrachten! 💪 (+${points} punten)`,
  almostDayBonus: () => "Nog 1 taakje en je hebt je dagbonus binnen! 🌟",
  weekBonus: () => "WAUW! Weekbonus verdiend — je bent een echte TaakHeld! 🏆",
  approved: (points: number) => `Goedgekeurd! +${points} punten erbij — lekker bezig! 🎉`,
  redo: (parentName: string) => `Bijna! ${parentName} vraagt of je nog even wil kijken 😉`,
} as const;

export const parentCopy = {
  redemption: (childName: string, rewardTitle: string) =>
    `${childName} wil graag inwisselen: ${rewardTitle}`,
  pinLock: (childName: string) =>
    `${childName} heeft 5x een verkeerde pincode geprobeerd — invoer is 15 minuten geblokkeerd.`,
} as const;

const DAILY_CHILD_PUSH_LIMIT = 2;
const APNS_HOST = "https://api.push.apple.com";

/** Valt HH:MM binnen [start, end)? Werkt ook over middernacht heen (19:30→07:00). */
export function isQuietTime(quietStart: string, quietEnd: string, hhmm: string): boolean {
  if (quietStart === quietEnd) return false;
  return quietStart < quietEnd
    ? hhmm >= quietStart && hhmm < quietEnd
    : hhmm >= quietStart || hhmm < quietEnd;
}

// APNs-JWT (ES256) is 50 min geldig per isolate; Apple accepteert max 1 u.
let cachedJwt: { token: string; expiresAt: number } | null = null;

async function apnsJwt(env: Env): Promise<string> {
  if (cachedJwt && cachedJwt.expiresAt > Date.now()) return cachedJwt.token;
  const key = await importPKCS8(env.APNS_KEY, "ES256");
  const token = await new SignJWT({ iss: env.APNS_TEAM_ID })
    .setProtectedHeader({ alg: "ES256", kid: env.APNS_KEY_ID })
    .setIssuedAt()
    .sign(key);
  cachedJwt = { token, expiresAt: Date.now() + 50 * 60 * 1000 };
  return token;
}

async function apnsSend(
  env: Env,
  tokens: string[],
  message: { title: string; body: string },
): Promise<number> {
  if (!env.APNS_KEY || !env.APNS_KEY_ID || !env.APNS_TEAM_ID || tokens.length === 0) {
    return 0; // geen secrets (dev/test) of geen apparaten: stille no-op
  }
  const jwt = await apnsJwt(env);
  let sent = 0;
  for (const token of tokens) {
    try {
      const res = await fetch(`${APNS_HOST}/3/device/${token}`, {
        method: "POST",
        headers: {
          authorization: `bearer ${jwt}`,
          "apns-topic": env.APPLE_CLIENT_ID, // bundle-id van de iOS-app
          "apns-push-type": "alert",
          "content-type": "application/json",
        },
        body: JSON.stringify({ aps: { alert: message, sound: "default" } }),
      });
      if (res.ok) sent++;
      else if (res.status === 410) await deleteDeadDeviceToken(env.DB, token); // Unregistered → opruimen
    } catch {
      // netwerk-hik: push is best-effort, nooit een mutatie laten falen
    }
  }
  return sent;
}

/** Push naar een kind: respecteert quiet hours en max 2 pushes per dag. */
export async function notifyChild(
  env: Env,
  familyId: string,
  childId: string,
  body: string,
): Promise<void> {
  const family = (await getFamily(env.DB, familyId)) as {
    timezone: string;
    quiet_start: string;
    quiet_end: string;
  } | null;
  if (!family) return;
  if (isQuietTime(family.quiet_start, family.quiet_end, localTime(family.timezone))) return;

  const countKey = `pushcount:${childId}:${localDate(family.timezone)}`;
  const used = Number((await env.KV.get(countKey)) ?? "0");
  if (used >= DAILY_CHILD_PUSH_LIMIT) return;

  const tokens = await listDeviceTokensForUsers(env.DB, familyId, [childId]);
  const sent = await apnsSend(env, tokens, { title: "TaakHelden", body });
  if (sent > 0) {
    await env.KV.put(countKey, String(used + 1), { expirationTtl: 60 * 60 * 24 });
  }
}

/** Push naar alle ouders van het gezin (geen quiet hours: dit zijn hun eigen meldingen). */
export async function notifyParents(env: Env, familyId: string, body: string): Promise<void> {
  const { results } = await getMembers(env.DB, familyId);
  const parentIds = results.filter((m) => m.role === "parent").map((m) => m.id as string);
  const tokens = await listDeviceTokensForUsers(env.DB, familyId, parentIds);
  await apnsSend(env, tokens, { title: "TaakHelden", body });
}

/** Roepnaam voor in pushtekst (nooit loggen — privacyregel 5). */
export async function memberName(env: Env, familyId: string, userId: string): Promise<string> {
  const member = await getMember(env.DB, familyId, userId);
  return ((member?.display_name as string) ?? "").trim() || "Iemand uit je gezin";
}
