import { describe, expect, it } from "vitest";
import { ParentTodayView } from "./types";

const parentTodayResponse = {
  date: "2026-07-26",
  children: [
    {
      childId: "ch_sofie",
      displayName: "Sofie",
      avatarId: null,
      instances: [
        {
          id: "ti_room",
          taskId: "tsk_room",
          childId: "ch_sofie",
          date: "2026-07-26",
          status: "approved",
          title: "Kamer opruimen",
          icon: "star",
          category: "household",
          points: 25,
          photoBonusPoints: 0,
          approvalRequired: false,
          daypart: null,
          photoId: null,
          photoStatus: null,
          pointsEarned: 25,
          redoNote: null,
          completedAt: "2026-07-26T08:00:00.000Z",
          approvedAt: "2026-07-26T08:00:00.000Z",
        },
      ],
      balance: {
        childId: "ch_sofie",
        balance: 145,
        todayCompleted: 1,
        todayTotal: 1,
        weekProgress: 1,
        streakDays: 1,
        lifetimeEarned: 145,
      },
    },
  ],
};

describe("ParentTodayView", () => {
  it("accepts the ledger-derived balance object returned by the API", () => {
    const parsed = ParentTodayView.parse(parentTodayResponse);

    expect(parsed.children[0]?.balance.balance).toBe(145);
    expect(parsed.children[0]?.balance.lifetimeEarned).toBe(145);
  });

  it("rejects the obsolete numeric balance shape", () => {
    expect(() =>
      ParentTodayView.parse({
        ...parentTodayResponse,
        children: [{ ...parentTodayResponse.children[0], balance: 145 }],
      }),
    ).toThrow();
  });
});
