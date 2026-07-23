/**
 * Tijd-helpers: alles in UTC, maar dag- en weekafbakening gebeurt in de
 * tijdzone van het gezin (IANA, bijv. Europe/Amsterdam).
 */

/** YYYY-MM-DD van `at` in de opgegeven tijdzone. */
export function localDate(timezone: string, at: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

/** HH:MM (24-uurs) van `at` in de opgegeven tijdzone — voor quiet hours. */
export function localTime(timezone: string, at: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(at);
}

const DAY_CODES = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"] as const;

/** Weekdagcode (MO..SU) van een YYYY-MM-DD-datum. */
export function weekdayCode(dateStr: string): (typeof DAY_CODES)[number] {
  const code = DAY_CODES[new Date(`${dateStr}T12:00:00Z`).getUTCDay()];
  if (!code) throw new Error(`invalid date: ${dateStr}`);
  return code;
}

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Alle 7 datums (ma t/m zo) van de week waar `dateStr` in valt. */
export function weekDates(dateStr: string): string[] {
  const dow = new Date(`${dateStr}T12:00:00Z`).getUTCDay(); // 0=zo
  const sinceMonday = (dow + 6) % 7;
  const monday = shiftDate(dateStr, -sinceMonday);
  return Array.from({ length: 7 }, (_, i) => shiftDate(monday, i));
}

/** Stabiele weeksleutel (maandag van de week) — ref_id van weekbonussen. */
export function weekKey(dateStr: string): string {
  const monday = weekDates(dateStr)[0]!;
  return `week:${monday}`;
}

/** ISO-weeknummer — bepaalt de beurt bij taakroulatie. */
export function isoWeekNumber(dateStr: string): number {
  const d = new Date(`${dateStr}T12:00:00Z`);
  const dayNum = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dayNum + 3); // donderdag van deze week
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  return 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000));
}

export function yesterdayOf(dateStr: string): string {
  return shiftDate(dateStr, -1);
}

/** Offset (lokale wandkloktijd − UTC) in ms voor `at` in `timezone`. */
function tzOffsetMs(timezone: string, at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const p: Record<string, number> = {};
  for (const part of parts) if (part.type !== "literal") p[part.type] = Number(part.value);
  const asUtc = Date.UTC(p.year!, p.month! - 1, p.day!, p.hour!, p.minute!, p.second!);
  return asUtc - at.getTime();
}

/**
 * UTC-tijdstempel ("YYYY-MM-DD HH:MM:SS") dat overeenkomt met 00:00 lokale tijd
 * op `localDateStr` in `timezone`. Zo vergelijk je een UTC `created_at` correct
 * met een gezins-lokale weekgrens, in plaats van de tijdzone-offset te negeren.
 */
export function localMidnightUtc(timezone: string, localDateStr: string): string {
  const naive = new Date(`${localDateStr}T00:00:00Z`);
  const offsetMs = tzOffsetMs(timezone, naive);
  return new Date(naive.getTime() - offsetMs).toISOString().slice(0, 19).replace("T", " ");
}
