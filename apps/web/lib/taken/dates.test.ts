import { describe, expect, it } from "vitest";
import {
  ageFromBirthYear,
  formatIsoDate,
  isDateRangeValid,
  mondayOfWeek,
  weekRange,
} from "./dates";

describe("taken date helpers", () => {
  it("computes age from birth year", () => {
    expect(ageFromBirthYear(2016, new Date("2026-07-28"))).toBe(10);
  });

  it("finds Monday of a week", () => {
    const monday = mondayOfWeek(new Date("2026-07-28")); // Tuesday
    expect(formatIsoDate(monday)).toBe("2026-07-27");
  });

  it("builds a seven-day week range", () => {
    const range = weekRange(new Date("2026-07-28"));
    expect(range.days).toHaveLength(7);
    expect(range.from).toBe("2026-07-27");
    expect(range.to).toBe("2026-08-02");
  });

  it("validates date ranges", () => {
    expect(isDateRangeValid("2026-08-01", "2026-08-15")).toBe(true);
    expect(isDateRangeValid("2026-08-15", "2026-08-01")).toBe(false);
  });
});
