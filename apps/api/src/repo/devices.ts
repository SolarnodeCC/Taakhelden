export async function registerDevice(
  db: D1Database,
  familyId: string,
  input: { userId: string; apnsToken: string; platform: string },
) {
  // Membership van userId binnen familyId is door de route gecheckt.
  await db
    .prepare(
      `INSERT INTO devices (apns_token, user_id, platform) VALUES (?, ?, ?)
       ON CONFLICT (apns_token, user_id) DO UPDATE SET platform = excluded.platform`,
    )
    .bind(input.apnsToken, input.userId, input.platform)
    .run();
}

/**
 * APNs meldde 410 (Unregistered): dit token is bij Apple ongeldig en dus overal
 * dood. We ruimen het gezins-onafhankelijk op — het hoort nergens meer thuis.
 */
export async function deleteDeadDeviceToken(db: D1Database, apnsToken: string) {
  await db.prepare("DELETE FROM devices WHERE apns_token = ?").bind(apnsToken).run();
}

/** Bij uitloggen: alle profiel-koppelingen van dit token binnen het gezin weg. */
export async function deleteDeviceToken(db: D1Database, familyId: string, apnsToken: string) {
  await db
    .prepare(
      "DELETE FROM devices WHERE apns_token = ? AND user_id IN (SELECT id FROM users WHERE family_id = ?)",
    )
    .bind(apnsToken, familyId)
    .run();
}

export async function listDeviceTokensForUsers(
  db: D1Database,
  familyId: string,
  userIds: string[],
): Promise<string[]> {
  if (userIds.length === 0) return [];
  const placeholders = userIds.map(() => "?").join(",");
  const { results } = await db
    .prepare(
      `SELECT DISTINCT d.apns_token FROM devices d
       JOIN users u ON u.id = d.user_id AND u.family_id = ? AND u.deleted_at IS NULL
       WHERE d.user_id IN (${placeholders})`,
    )
    .bind(familyId, ...userIds)
    .all();
  return results.map((r) => r.apns_token as string);
}
