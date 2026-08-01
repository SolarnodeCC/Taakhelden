import { Hono } from "hono";
import { z } from "zod";
import { InsightsRange, WeeklyInsightsResponse, ErrorCodes } from "@taakhelden/shared";
import type { AppBindings } from "../types";
import { ApiException } from "../middleware/error";
import { requireParent } from "../middleware/authz";
import { validate } from "../middleware/validate";
import { weeklyInsights } from "../repo/insights";

const insights = new Hono<AppBindings>();

const InsightsQuery = z.object({
  range: InsightsRange.default("week"),
  weekOf: z.string().date().optional(),
  childId: z.string().optional(),
});

insights.get(
  "/",
  validate("query", InsightsQuery),
  async (c) => {
    const { familyId } = requireParent(c);
    const { range, weekOf, childId } = c.req.valid("query");

    // weekOf standaard: maandag van de huidige ISO-week
    const resolvedWeekOf = weekOf ?? mondayOfCurrentWeek();

    if (range !== "week") {
      throw new ApiException(400, ErrorCodes.VALIDATION_FAILED, "Alleen 'week' range is op dit moment beschikbaar.");
    }

    const { weekOf: resultWeekOf, children } = await weeklyInsights(c.env.DB, familyId, {
      weekOf: resolvedWeekOf,
      childId,
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

function mondayOfCurrentWeek(): string {
  const now = new Date();
  const dow = now.getUTCDay(); // 0 = zo
  const sinceMonday = (dow + 6) % 7;
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() - sinceMonday);
  return monday.toISOString().slice(0, 10);
}

export default insights;
