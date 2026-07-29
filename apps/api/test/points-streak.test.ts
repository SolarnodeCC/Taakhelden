/**
 * Streakbescherming (productbelofte): één gemiste dag per ISO-kalenderweek
 * (ma t/m zo) breekt de streak niet; de tweede gemiste dag in diezelfde week wel.
 *
 * Alle datums hieronder zijn vast gekozen zodat de weekgrenzen expliciet zijn:
 *   week A: ma 2026-03-09 t/m zo 2026-03-15  (2026-03-15 = zondag)
 *   week B: ma 2026-03-02 t/m zo 2026-03-08
 */
import { describe, it, expect } from "vitest";
import { env } from "cloudflare:test";
import { computeStreak } from "../src/services/pointsEngine";
import { weekKey, yesterdayOf } from "../src/services/time";
import { seedFamily, childToken, api, todayAmsterdam } from "./helpers";

const SUNDAY = "2026-03-15";

/** Bonusdatums zoals het ledger ze levert: aflopend gesorteerd. */
function desc(...dates: string[]) {
  return [...dates].sort().reverse();
}

describe("computeStreak", () => {
  it("weekgrenzen van de testdatums zijn zoals bedoeld", () => {
    expect(weekKey(SUNDAY)).toBe("week:2026-03-09");
    expect(weekKey("2026-03-09")).toBe("week:2026-03-09");
    expect(weekKey("2026-03-08")).toBe("week:2026-03-02");
  });

  it("zonder dagbonussen is er geen streak", () => {
    expect(computeStreak([], SUNDAY)).toBe(0);
  });

  it("aaneengesloten dagen leveren de volledige streak", () => {
    const dates = desc("2026-03-13", "2026-03-14", "2026-03-15");
    expect(computeStreak(dates, SUNDAY)).toBe(3);
  });

  it("vandaag nog niet verdiend: streak loopt t/m gisteren en kost geen vergeving", () => {
    const dates = desc("2026-03-12", "2026-03-13", "2026-03-14");
    // Vandaag (03-15) mist, maar de dag is nog niet voorbij: 3 dagen t/m gisteren.
    // Zou dat wél als gemiste dag tellen, dan brak 03-11 (2e gat) de streak op 2.
    expect(computeStreak(dates, SUNDAY)).toBe(3);
  });

  it("één gemiste dag in de week: de streak loopt over het gat door", () => {
    // gat op 03-13 (week A); 03-11 is de eerstvolgende ontbrekende dag en stopt 'm.
    const dates = desc("2026-03-12", "2026-03-14", "2026-03-15");
    expect(computeStreak(dates, SUNDAY)).toBe(3);
  });

  it("tweede gemiste dag in dezelfde week stopt de streak", () => {
    // gaten op 03-14 en 03-12, beide in week A → streak stopt bij het tweede gat.
    const dates = desc("2026-03-11", "2026-03-13", "2026-03-15");
    expect(computeStreak(dates, SUNDAY)).toBe(2);
  });

  it("een overgeslagen dag telt zelf niet mee als streakdag", () => {
    const withGap = computeStreak(desc("2026-03-13", "2026-03-15"), SUNDAY);
    const withoutGap = computeStreak(desc("2026-03-13", "2026-03-14", "2026-03-15"), SUNDAY);
    expect(withGap).toBe(2);
    expect(withoutGap).toBe(3);
  });

  it("elke week krijgt zijn eigen vergeving (gaten in verschillende weken)", () => {
    const weekA = ["2026-03-09", "2026-03-10", "2026-03-12", "2026-03-13", "2026-03-14", "2026-03-15"]; // gat 03-11
    const weekB = ["2026-03-02", "2026-03-03", "2026-03-04", "2026-03-06", "2026-03-07", "2026-03-08"]; // gat 03-05
    expect(computeStreak(desc(...weekA, ...weekB), SUNDAY)).toBe(12);
  });

  it("een tweede gat in week B stopt de streak, week A blijft volledig meetellen", () => {
    const weekA = ["2026-03-09", "2026-03-10", "2026-03-11", "2026-03-12", "2026-03-13", "2026-03-14", "2026-03-15"];
    const weekB = ["2026-03-06", "2026-03-08"]; // gaten op 03-07 en 03-05
    expect(computeStreak(desc(...weekA, ...weekB), SUNDAY)).toBe(9);
  });
});

/** Dagbonus in het ledger boeken zoals bookPoints dat doet: ref_id = de datum. */
async function seedDayBonus(familyId: string, childId: string, dates: string[]) {
  for (const [i, date] of dates.entries()) {
    await env.DB
      .prepare(
        `INSERT INTO points_ledger (id, family_id, child_id, type, amount, ref_id)
         VALUES (?, ?, ?, 'day_bonus', 20, ?)`,
      )
      .bind(`pl_streak${childId}${i}`, familyId, childId, date)
      .run();
  }
}

describe("GET /points/balance — streakDays", () => {
  it("een gemiste dag in de week breekt de streak niet", async () => {
    const fam = await seedFamily("strk");
    const today = todayAmsterdam();
    const gap = yesterdayOf(yesterdayOf(today)); // vandaag − 2: de vergeven dag
    await seedDayBonus(fam.familyId, fam.childA, [today, yesterdayOf(today), yesterdayOf(gap)]);

    const res = await api("/points/balance", { token: await childToken(fam.childA, fam.familyId) });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { streakDays: number };
    expect(body.streakDays).toBe(3); // 3 dagbonussen, het gat is vergeven en telt niet mee
  });
});
