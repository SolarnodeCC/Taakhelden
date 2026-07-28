import { describe, expect, it } from "vitest";
import {
  WsMessage,
  WsInstanceUpdatedData,
  WsPointsChangedData,
  WsRedemptionUpdatedData,
} from "@taakhelden/shared";
import {
  CreateChildBody,
  FamilyPatchBody,
  InviteParentBody,
  ParentAcceptBody,
  RegisterBody,
} from "@taakhelden/shared";
import {
  AdjustBody,
  ExportJobView,
  NotificationSettingsResponse,
} from "@taakhelden/shared";
import {
  FamilyView,
  InviteCodeResult,
  InviteParentResult,
  InstanceHistoryResponse,
  LedgerEntryView,
  LedgerPage,
  MemberList,
  ParentBalancesResponse,
  parentBalancesChildren,
  ParentTodayView,
  TaskTemplatesResponse,
  TaskView,
} from "./types";
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

describe("Batch 8 schemas", () => {
  it("parses FamilyView with settings fields", () => {
    const parsed = FamilyView.parse({
      id: "fam_1",
      name: "Jansen",
      timezone: "Europe/Amsterdam",
      inviteCode: "AB12CD",
      quietStart: "19:30",
      quietEnd: "07:00",
      dayBonusPoints: 20,
      weekBonusPoints: 100,
      weekBonusThreshold: 0.8,
      vacationMode: false,
    });
    expect(parsed.vacationMode).toBe(false);
    expect(parsed.weekBonusThreshold).toBe(0.8);
  });

  it("parses FamilyPatchBody partial", () => {
    const parsed = FamilyPatchBody.parse({
      name: "Familie de Vries",
      vacationMode: true,
      weekBonusThreshold: 0.5,
    });
    expect(parsed.vacationMode).toBe(true);
    expect(parsed.weekBonusThreshold).toBe(0.5);
  });

  it("rejects weekBonusThreshold below 0.5", () => {
    expect(() => FamilyPatchBody.parse({ weekBonusThreshold: 0.4 })).toThrow();
  });

  it("parses InviteParentBody with default permissions", () => {
    const parsed = InviteParentBody.parse({ email: "opa@example.nl" });
    expect(parsed.permissions).toBe("approve_only");
  });

  it("parses InviteParentResult", () => {
    const parsed = InviteParentResult.parse({
      userId: "usr_1",
      email: "opa@example.nl",
      permissions: "full",
      inviteToken: "tok_abc",
    });
    expect(parsed.inviteToken).toBe("tok_abc");
  });

  it("parses ParentAcceptBody with min password 8", () => {
    const parsed = ParentAcceptBody.parse({
      token: "tok_abc",
      password: "achttekens",
      displayName: "Opa",
    });
    expect(parsed.displayName).toBe("Opa");
  });

  it("rejects short passwords on ParentAcceptBody", () => {
    expect(() =>
      ParentAcceptBody.parse({ token: "tok_abc", password: "kort" }),
    ).toThrow();
  });
});

describe("Batch 9 schemas", () => {
  it("parses TaskView with rotation and active window", () => {
    const parsed = TaskView.parse({
      id: "tsk_1",
      title: "Vaatwasser",
      category: "household",
      icon: "dishwasher",
      points: 15,
      photoBonusPoints: 0,
      approvalRequired: false,
      assignees: ["ch_a", "ch_b"],
      rotation: ["ch_a", "ch_b"],
      recurrence: { freq: "weekly", days: ["MO", "WE"] },
      daypart: "evening",
      activeFrom: "2026-08-01",
      activeUntil: "2026-08-31",
    });
    expect(parsed.rotation).toEqual(["ch_a", "ch_b"]);
    expect(parsed.activeUntil).toBe("2026-08-31");
  });

  it("parses task templates response", () => {
    const parsed = TaskTemplatesResponse.parse({
      age: 8,
      templates: [
        {
          title: "Vaatwasser uitruimen",
          category: "household",
          icon: "dishwasher",
          points: 15,
        },
      ],
    });
    expect(parsed.templates[0]?.title).toBe("Vaatwasser uitruimen");
  });

  it("parses instance history response", () => {
    const parsed = InstanceHistoryResponse.parse({
      instances: [
        {
          id: "ti_1",
          taskId: "tsk_1",
          childId: "ch_1",
          date: "2026-07-28",
          status: "open",
          title: "Kamer opruimen",
          icon: "star",
          category: "household",
          points: 10,
          photoBonusPoints: 0,
          approvalRequired: false,
          daypart: null,
          photoId: null,
          photoStatus: null,
          pointsEarned: null,
          redoNote: null,
          completedAt: null,
          approvedAt: null,
        },
      ],
      nextCursor: null,
    });
    expect(parsed.instances).toHaveLength(1);
  });
});

describe("Batch 10 schemas", () => {
  it("parses notification settings response", () => {
    const parsed = NotificationSettingsResponse.parse({
      settings: [
        { childId: "ch_1", enabled: true, quietStart: null, quietEnd: null },
        { childId: "ch_2", enabled: false, quietStart: "20:00", quietEnd: "07:30" },
      ],
    });
    expect(parsed.settings).toHaveLength(2);
  });

  it("parses parent balances response (v1 and v2)", () => {
    const balance = {
      childId: "ch_1",
      balance: 42,
      todayCompleted: 1,
      todayTotal: 2,
      weekProgress: 0.5,
      streakDays: 3,
      lifetimeEarned: 100,
    };
    const v1 = ParentBalancesResponse.parse({ children: [balance] });
    const v2 = ParentBalancesResponse.parse({ viewer: "parent", children: [balance] });
    expect(parentBalancesChildren(v1)[0]?.balance).toBe(42);
    expect(parentBalancesChildren(v2)[0]?.balance).toBe(42);
  });

  it("parses ledger page", () => {
    const parsed = LedgerPage.parse({
      entries: [
        {
          id: "pl_1",
          type: "adjustment",
          amount: 10,
          ref: null,
          note: "Extra hulp",
          at: "2026-07-28T10:00:00.000Z",
        },
      ],
      nextCursor: "abc",
    });
    expect(LedgerEntryView.parse(parsed.entries[0]).type).toBe("adjustment");
  });

  it("parses AdjustBody and ExportJobView", () => {
    expect(
      AdjustBody.parse({ childId: "ch_1", amount: 5, note: "Goed gedaan" }).amount,
    ).toBe(5);
    expect(
      ExportJobView.parse({
        exportId: "exp_1",
        status: "ready",
        downloadUrl: "https://example.test/file",
      }).status,
    ).toBe("ready");
  });

  it("rejects negative adjust amounts", () => {
    expect(() =>
      AdjustBody.parse({ childId: "ch_1", amount: -1, note: "x" }),
    ).toThrow();
  });
});

describe("WsMessage", () => {
  it("parses instance.updated", () => {
    const msg = WsMessage.parse({
      event: "instance.updated",
      data: { instanceId: "ti_1", status: "submitted", childId: "ch_1" },
    });
    expect(WsInstanceUpdatedData.parse(msg.data).instanceId).toBe("ti_1");
  });

  it("parses points.changed", () => {
    const msg = WsMessage.parse({
      event: "points.changed",
      data: { childId: "ch_1", newBalance: 42 },
    });
    expect(WsPointsChangedData.parse(msg.data).newBalance).toBe(42);
  });

  it("parses redemption.updated", () => {
    const msg = WsMessage.parse({
      event: "redemption.updated",
      data: { redemptionId: "rd_1", status: "fulfilled", childId: "ch_1" },
    });
    expect(WsRedemptionUpdatedData.parse(msg.data).status).toBe("fulfilled");
  });
});
