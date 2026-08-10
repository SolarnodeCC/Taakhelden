/**
 * Push (APNs voor iOS, FCM voor Android) + de catalogus van positieve
 * notificatieteksten. Regels: max 2/dag per kind, nooit binnen quiet hours, nooit
 * schuldgevoel-taal (stijlgids: docs/taakhelden-productvoorstel.md §3.7). Zonder
 * gateway-secrets (lokaal/test) is verzenden een stille no-op. Log nooit namen of
 * tokens.
 */
import { SignJWT, importPKCS8 } from "jose";
import { PushPayload } from "@taakhelden/shared";
import type { Env } from "../types";
import { getFamily, getMembers, getMember } from "../repo/families";
import {
  listDeviceTokensForUsers,
  deleteDeadDeviceToken,
  type DeviceToken,
} from "../repo/devices";
import { getSetting } from "../repo/notifications";
import { localDate, localTime } from "./time";

export const childCopy = {
  taskOpen: (title: string, points: number) => {
    void title;
    void points;
    return "Er staat iets nieuws klaar in Wispel.";
  },
  almostDayBonus: () => "Er staat iets leuks klaar in Wispel.",
  weekBonus: () => "Er staat iets leuks klaar in Wispel.",
  approved: (points: number) => {
    void points;
    return "Er staat iets leuks klaar in Wispel.";
  },
  redo: (parentName: string) => {
    void parentName;
    return "Er is iets bijgewerkt in Wispel.";
  },
} as const;

export const parentCopy = {
  redemption: (childName: string, rewardTitle: string) => {
    void childName;
    void rewardTitle;
    return "Er wacht iets op je goedkeuring in Wispel.";
  },
  pinLock: (childName: string) => {
    void childName;
    return "Er is iets belangrijks in Wispel.";
  },
} as const;

const DAILY_CHILD_PUSH_LIMIT = 2;
const APNS_HOSTS = {
  production: "https://api.push.apple.com",
  sandbox: "https://api.sandbox.push.apple.com",
} as const;
const FCM_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";

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

// FCM OAuth2-token (RS256 service account) is 1 u geldig; ververs iets eerder.
let cachedFcmToken: { token: string; expiresAt: number } | null = null;

async function fcmAccessToken(
  env: Env & { FCM_CLIENT_EMAIL: string; FCM_PRIVATE_KEY: string },
): Promise<string | null> {
  if (cachedFcmToken && cachedFcmToken.expiresAt > Date.now()) return cachedFcmToken.token;
  const key = await importPKCS8(env.FCM_PRIVATE_KEY, "RS256");
  const assertion = await new SignJWT({ scope: FCM_SCOPE })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(env.FCM_CLIENT_EMAIL)
    .setSubject(env.FCM_CLIENT_EMAIL)
    .setAudience(FCM_TOKEN_ENDPOINT)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(key);

  const res = await fetch(FCM_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) return null;
  cachedFcmToken = {
    token: json.access_token,
    expiresAt: Date.now() + ((json.expires_in ?? 3600) - 300) * 1000,
  };
  return cachedFcmToken.token;
}

/**
 * FCM HTTP v1 — de Android-tegenhanger van `apnsSend`.
 *
 * Zelfde contract: best-effort, nooit een mutatie laten falen, en zonder secrets een
 * stille no-op. De lockscreen-tekst blijft generiek (geen taaknamen of foto's), net als
 * bij APNs. Data-only velden gaan mee onder `th`, zodat de client dezelfde payload ziet.
 */
async function fcmSend(
  env: Env,
  tokens: string[],
  message: { title: string; body: string },
  payload: PushPayload,
): Promise<number> {
  if (
    !env.FCM_PROJECT_ID ||
    !env.FCM_CLIENT_EMAIL ||
    !env.FCM_PRIVATE_KEY ||
    tokens.length === 0
  ) {
    return 0; // geen secrets (dev/test) of geen apparaten: stille no-op
  }
  const fcmEnv = env as Env & { FCM_CLIENT_EMAIL: string; FCM_PRIVATE_KEY: string };
  const accessToken = await fcmAccessToken(fcmEnv);
  if (!accessToken) return 0;

  const endpoint = `https://fcm.googleapis.com/v1/projects/${env.FCM_PROJECT_ID}/messages:send`;
  let sent = 0;
  for (const token of tokens) {
    try {
      const parsedPayload = PushPayload.parse(payload);
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          authorization: `Bearer ${accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          message: {
            token,
            // A silent refresh must not draw a notification; a normal push must.
            ...(parsedPayload.contentAvailable ? {} : { notification: message }),
            android: {
              priority: parsedPayload.contentAvailable ? "NORMAL" : "HIGH",
            },
            data: { th: JSON.stringify(parsedPayload) },
          },
        }),
      });
      if (res.ok) sent++;
      // 404 UNREGISTERED / 403 SENDER_ID_MISMATCH: token is dood → opruimen.
      else if (res.status === 404) await deleteDeadDeviceToken(env.DB, token);
    } catch {
      // netwerk-hik: push is best-effort, nooit een mutatie laten falen
    }
  }
  return sent;
}

/** Verstuurt naar beide gateways en telt het totaal aantal geslaagde pushes. */
async function pushToDevices(
  env: Env,
  devices: DeviceToken[],
  message: { title: string; body: string },
  payload: PushPayload,
): Promise<number> {
  const apnsTokens = devices.filter((d) => d.platform !== "android").map((d) => d.token);
  const fcmTokens = devices.filter((d) => d.platform === "android").map((d) => d.token);
  const [apns, fcm] = await Promise.all([
    apnsSend(env, apnsTokens, message, payload),
    fcmSend(env, fcmTokens, message, payload),
  ]);
  return apns + fcm;
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

  const devices = await listDeviceTokensForUsers(env.DB, familyId, [childId]);
  const sent = await pushToDevices(env, devices, { title: "Wispel", body }, payload);
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
  const devices = await listDeviceTokensForUsers(env.DB, familyId, parentIds);
  await pushToDevices(env, devices, { title: "Wispel", body }, payload);
}

/** Roepnaam voor in pushtekst (nooit loggen — privacyregel 5). */
export async function memberName(env: Env, familyId: string, userId: string): Promise<string> {
  const member = await getMember(env.DB, familyId, userId);
  return ((member?.display_name as string) ?? "").trim() || "Iemand uit je gezin";
}
