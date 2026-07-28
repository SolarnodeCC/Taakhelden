/** Monday-based week range (ISO-style week display, gezin timezone not applied here). */
export function mondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function formatIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function weekRange(anchor: Date): { from: string; to: string; days: string[] } {
  const monday = mondayOfWeek(anchor);
  const days = Array.from({ length: 7 }, (_, i) => formatIsoDate(addDays(monday, i)));
  return { from: days[0]!, to: days[6]!, days };
}

export function ageFromBirthYear(birthYear: number, now = new Date()): number {
  return now.getFullYear() - birthYear;
}

export function isDateRangeValid(from: string, until: string): boolean {
  return until >= from;
}
