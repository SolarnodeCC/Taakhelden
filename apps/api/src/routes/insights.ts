import { Hono } from "hono";
import { InsightsQuery, WeeklyInsightsResponse, ErrorCodes } from "@taakhelden/shared";
import type { AppBindings } from "../types";
import { ApiException } from "../middleware/error";
import { requireParent } from "../middleware/authz";
import { validate } from "../middleware/validate";
import { weeklyInsights } from "../repo/insights";
import { getFamily } from "../repo/families";
import { localDate, weekDates } from "../services/time";

const insights = new Hono<AppBindings>();

insights.get(
  "/",
  validate("query", InsightsQuery),
  async (c) => {
    const { familyId } = requireParent(c);
    const { range, weekOf, childId } = c.req.valid("query");

    if (range !== "week") {
      throw new ApiException(400, ErrorCodes.VALIDATION_FAILED, "Alleen 'week' range is op dit moment beschikbaar.");
    }

    // Weekgrenzen volgen de gezins-kalender, niet UTC: vlak na middernacht lokale
    // tijd wijst UTC nog naar gisteren — en op maandagochtend dus naar de vorige week.
    const family = (await getFamily(c.env.DB, familyId)) as { timezone?: unknown } | null;
    const today = localDate(
      typeof family?.timezone === "string" ? family.timezone : "Europe/Amsterdam",
    );
    const resolvedWeekOf = weekOf ?? weekDates(today)[0]!;

    const { weekOf: resultWeekOf, children } = await weeklyInsights(c.env.DB, familyId, {
      weekOf: resolvedWeekOf,
      childId,
      today,
    });

    return c.json(
      WeeklyInsightsResponse.parse({
        weekOf: resultWeekOf,
        range: "week",
        children,
      }),
    );
  },
);

export default insights;
