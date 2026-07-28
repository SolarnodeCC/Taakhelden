import { describe, expect, it } from "vitest";
import { CreateChildBody, RegisterBody } from "@taakhelden/shared";
import { FamilyView, InviteCodeResult, MemberList, ParentTodayView } from "./types";
import { AVATAR_PLACEHOLDERS, avatarEmoji } from "../avatars";

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

describe("Batch 7 schemas", () => {
  it("parses RegisterBody with turnstile token", () => {
    const parsed = RegisterBody.parse({
      email: "ouder@example.nl",
      password: "veiliggenoeg",
      familyName: "Familie Jansen",
      displayName: "Sam",
      turnstileToken: "dev-bypass",
    });
    expect(parsed.familyName).toBe("Familie Jansen");
  });

  it("rejects short passwords on RegisterBody", () => {
    expect(() =>
      RegisterBody.parse({
        email: "ouder@example.nl",
        password: "kort",
        familyName: "Familie Jansen",
        displayName: "Sam",
        turnstileToken: "dev-bypass",
      }),
    ).toThrow();
  });

  it("parses CreateChildBody", () => {
    const parsed = CreateChildBody.parse({
      displayName: "Sofie",
      birthYear: 2016,
      pincode: "1234",
      avatarId: "fox",
    });
    expect(parsed.avatarId).toBe("fox");
  });

  it("parses family view with invite code", () => {
    const parsed = FamilyView.parse({
      id: "fam_1",
      name: "Jansen",
      timezone: "Europe/Amsterdam",
      inviteCode: "AB12CD",
    });
    expect(parsed.inviteCode).toBe("AB12CD");
  });

  it("parses invite-code regenerate result", () => {
    expect(InviteCodeResult.parse({ inviteCode: "ZZ99YY" }).inviteCode).toBe("ZZ99YY");
  });

  it("parses member list with child age fields", () => {
    const members = MemberList.parse([
      {
        id: "ch_1",
        role: "child",
        displayName: "Sofie",
        birthYear: 2016,
        ageMode: "mid",
        avatarId: "fox",
      },
    ]);
    expect(members[0]?.ageMode).toBe("mid");
  });

  it("resolves avatar placeholders", () => {
    expect(AVATAR_PLACEHOLDERS.length).toBeGreaterThanOrEqual(5);
    expect(avatarEmoji("fox")).toBe("🦊");
    expect(avatarEmoji(null)).toBeNull();
  });
});
