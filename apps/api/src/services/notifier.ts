/**
 * APNs-push + de catalogus van positieve notificatieteksten.
 * Regels: max 2/dag per kind, nooit binnen quiet hours, nooit schuldgevoel-taal
 * (stijlgids: docs/taakhelden-productvoorstel.md §3.7). Zonder APNS-secrets
 * (lokaal/test) is verzenden een stille no-op. Log nooit namen of tokens.
 */
import { SignJWT, importPKCS8 } from "jose";
import { PushPayload } from "@taakhelden/shared";
import type { Env } from "../types";
import { getFamily, getMembers, getMember } from "../repo/families";
import { listDeviceTokensForUsers, deleteDeadDeviceToken } from "../repo/devices";
import { getSetting } from "../repo/notifications";
import { localDate, localTime } from "./time";

export const childCopy = {
  taskOpen: (title: string, points: number) => {
    void title;
    void points;
    return "Er staat iets nieuws klaar in TaakHelden.";
  },
  almostDayBonus: () => "Er staat iets leuks klaar in TaakHelden.",
  weekBonus: () => "Er staat iets leuks klaar in TaakHelden.",
  approved: (points: number) => {
    void points;
    return "Er staat iets leuks klaar in TaakHelden.";
  },
  redo: (parentName: string) => {
    void parentName;
    return "Er is iets bijgewerkt in TaakHelden.";
  },
} as const;

export const parentCopy = {
  redemption: (childName: string, rewardTitle: string) => {
    void childName;
    void rewardTitle;
    return "Er wacht iets op je goedkeuring in TaakHelden.";
  },
  pinLock: (childName: string) => {
    void childName;
    return "Er is iets belangrijks in TaakHelden.";
  },
} as const;

const DAILY_CHILD_PUSH_LIMIT = 2;
const APNS_HOSTS = {
  production: "https://api.push.apple.com",
  sandbox: "https://api.sandbox.push.apple.com",
} as const;

/** Valt HH:MM binnen [start, end)? Werkt ook over middernacht heen (19:30→07:00). */
export function isQuietTime(quietStart: string, quietEnd: string, hhmm: string): boolean {
  if (quietStart === quietEnd) return false;
  return quietStart < quietEnd
    ? hhmm >= quietStart && hhmm < quietEnd
    : hhmm >= quietStart || hhmm < quietEnd;
}

// APNs-JWT (ES256) is 50 min geldig per isolate; Apple accepteert max 1 u.
let cachedJwt: { token: string; expiresAt: number } | null = null;

async function apnsJwt(
  env: Env & { APNS_KEY: string; APNS_KEY_ID: string; APNS_TEAM_ID: string },
): Promise<string> {
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
  payload: PushPayload,
): Promise<number> {
  if (!env.APNS_KEY || !env.APNS_KEY_ID || !env.APNS_TEAM_ID || tokens.length === 0) {
    return 0; // geen secrets (dev/test) of geen apparaten: stille no-op
  }
  const apnsEnv = env as Env & {
    APNS_KEY: string;
    APNS_KEY_ID: string;
    APNS_TEAM_ID: string;
  };
  const jwt = await apnsJwt(apnsEnv);
  const host = env.APNS_ENV === "sandbox" ? APNS_HOSTS.sandbox : APNS_HOSTS.production;
  const topic = env.APPLE_BUNDLE_ID ?? env.APPLE_CLIENT_ID ?? "nl.taakhelden.app";
  let sent = 0;
  for (const token of tokens) {
    try {
      const parsedPayload = PushPayload.parse(payload);
      const res = await fetch(`${host}/3/device/${token}`, {
        method: "POST",
        headers: {
          authorization: `bearer ${jwt}`,
          "apns-topic": topic,
          "apns-push-type": "alert",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          aps: {
            alert: message,
            sound: "default",
            ...(parsedPayload.contentAvailable ? { "content-available": 1 } : {}),
          },
          th: parsedPayload,
        }),
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
  payload: PushPayload,
): Promise<void> {
  const family = (await getFamily(env.DB, familyId)) as {
    timezone: string;
    quiet_start: string;
    quiet_end: string;
  } | null;
  if (!family) return;
  const setting = await getSetting(env.DB, familyId, childId);
  if (!setting || !setting.enabled) return;
  const quietStart = setting.quiet_start ?? family.quiet_start;
  const quietEnd = setting.quiet_end ?? family.quiet_end;
  if (isQuietTime(quietStart, quietEnd, localTime(family.timezone))) return;

  const countKey = `pushcount:${childId}:${localDate(family.timezone)}`;
  const used = Number((await env.KV.get(countKey)) ?? "0");
  if (used >= DAILY_CHILD_PUSH_LIMIT) return;

  const tokens = await listDeviceTokensForUsers(env.DB, familyId, [childId]);
  const sent = await apnsSend(env, tokens, { title: "TaakHelden", body }, payload);
  if (sent > 0) {
    await env.KV.put(countKey, String(used + 1), { expirationTtl: 60 * 60 * 24 });
  }
}

/** Push naar alle ouders van het gezin (geen quiet hours: dit zijn hun eigen meldingen). */
export async function notifyParents(
  env: Env,
  familyId: string,
  body: string,
  payload: PushPayload,
): Promise<void> {
  const { results } = await getMembers(env.DB, familyId);
  const parentIds = results.filter((m) => m.role === "parent").map((m) => m.id as string);
  const tokens = await listDeviceTokensForUsers(env.DB, familyId, parentIds);
  await apnsSend(env, tokens, { title: "TaakHelden", body }, payload);
}

/** Roepnaam voor in pushtekst (nooit loggen — privacyregel 5). */
export async function memberName(env: Env, familyId: string, userId: string): Promise<string> {
  const member = await getMember(env.DB, familyId, userId);
  return ((member?.display_name as string) ?? "").trim() || "Iemand uit je gezin";
}
