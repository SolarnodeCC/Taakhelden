/**
 * Onherroepelijke opschoning van verwijderde gezinnen ná het 7-daagse venster
 * (AVG art. 17): R2-prefix + KV-sleutels + D1-cascade. Aangeroepen door de
 * dagelijkse cron; ook los aanroepbaar per gezin.
 */
import type { Env } from "../types";
import * as account from "../repo/account";

const PURGE_AFTER_DAYS = 7;

export async function purgeExpiredAccounts(env: Env, now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - PURGE_AFTER_DAYS * 24 * 3600 * 1000).toISOString();
  const familyIds = await account.listExpiredFamilies(env.DB, cutoff);
  for (const familyId of familyIds) {
    await purgeFamily(env, familyId);
  }
  return familyIds.length;
}

/** Verwijdert álle sporen van één gezin uit R2, KV en D1. */
export async function purgeFamily(env: Env, familyId: string): Promise<void> {
  // User-id's eerst ophalen: na de D1-cascade zijn ze weg.
  const userIds = await account.familyUserIds(env.DB, familyId);

  // R2-foto's staan onder task/<familyId>/ en profile/<familyId>/ (zie photoService),
  // export-ZIP's onder export/<familyId>/ (zie exportService).
  await deleteR2Prefix(env.PHOTOS, `task/${familyId}/`);
  await deleteR2Prefix(env.PHOTOS, `profile/${familyId}/`);
  await deleteR2Prefix(env.PHOTOS, `export/${familyId}/`);

  for (const userId of userIds) {
    await deleteKvPrefix(env.KV, `idem:${userId}:`);
    await env.KV.delete(`pinfail:${userId}`);
  }

  await account.purgeFamilyD1(env.DB, familyId);
}

/** Alle R2-objecten onder een prefix verwijderen (gepagineerd). */
async function deleteR2Prefix(bucket: R2Bucket, prefix: string): Promise<void> {
  let cursor: string | undefined;
  do {
    const listed = await bucket.list({ prefix, cursor });
    if (listed.objects.length > 0) {
      await bucket.delete(listed.objects.map((o) => o.key));
    }
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);
}

/** Alle KV-sleutels onder een prefix verwijderen (gepagineerd). */
async function deleteKvPrefix(kv: KVNamespace, prefix: string): Promise<void> {
  let cursor: string | undefined;
  do {
    const listed = await kv.list({ prefix, cursor });
    await Promise.all(listed.keys.map((k) => kv.delete(k.name)));
    cursor = listed.list_complete ? undefined : listed.cursor;
  } while (cursor);
}
