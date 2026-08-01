/**
 * WS-PROPOSAL (Taakvraag): authz, ledger-invariant en idempotentie.
 *
 * Dekt:
 *  - POST /tasks/proposals: alleen kind, alleen tienerregister, Idempotency-Key verplicht
 *  - GET /tasks/proposals: ouder ziet alles, kind alleen eigen vragen
 *  - POST /tasks/proposals/:id/approve: ouder `full`, maakt een echte taak, GEEN ledger-boeking
 *  - POST /tasks/proposals/:id/decline: ouder `full`, vriendelijke toelichting
 *  - Cross-family: 404 op andermans taakvraag
 *  - Dubbel goedkeuren levert precies één taak en één beslissing op
 */
import { describe, it, expect } from "vitest";
import { env } from "cloudflare:test";
import { seedFamily, parentToken, childToken, api } from "./helpers";
import { balance as ledgerBalance } from "../src/repo/ledger";

/** Zet een kind in het tienerregister — de seed maakt standaard `mid`-kinderen. */
async function makeTeen(familyId: string, childId: string) {
  await env.DB.prepare(
    "UPDATE users SET age_mode = 'teen', birth_year = ? WHERE family_id = ? AND id = ?",
  )
    .bind(new Date().getFullYear() - 14, familyId, childId)
    .run();
}

async function seedProposal(familyId: string, childId: string, title = "Auto wassen") {
  const id = `prp_test${Math.random().toString(36).slice(2)}`;
  await env.DB.prepare(
    `INSERT INTO task_proposals (id, family_id, child_id, title, category, icon, suggested_points, note)
     VALUES (?, ?, ?, ?, 'household', 'star', 20, 'Ik wil graag sparen')`,
  )
    .bind(id, familyId, childId, title)
    .run();
  return id;
}

async function countTasks(familyId: string) {
  const row = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM tasks WHERE family_id = ? AND archived_at IS NULL",
  )
    .bind(familyId)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

async function countLedger(familyId: string) {
  const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM points_ledger WHERE family_id = ?")
    .bind(familyId)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

const CREATE_BODY = {
  title: "Auto wassen",
  suggestedPoints: 25,
  note: "Ik wil sparen voor de bioscoop",
};

// ============================================================
// POST /tasks/proposals — aanmaken
// ============================================================

describe("POST /tasks/proposals", () => {
  it("tiener kan een taakvraag indienen", async () => {
    const fam = await seedFamily("prp_create");
    await makeTeen(fam.familyId, fam.childA);

    const res = await api("/tasks/proposals", {
      token: await childToken(fam.childA, fam.familyId),
      body: CREATE_BODY,
      idempotencyKey: "prp-create-1",
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      id: string;
      childId: string;
      status: string;
      suggestedPoints: number;
      createdTaskId: string | null;
    };
    expect(body.childId).toBe(fam.childA);
    expect(body.status).toBe("pending");
    expect(body.suggestedPoints).toBe(25);
    expect(body.createdTaskId).toBeNull();
  });

  it("een taakvraag maakt GEEN taak en GEEN ledger-boeking", async () => {
    const fam = await seedFamily("prp_noledger");
    await makeTeen(fam.familyId, fam.childA);

    const res = await api("/tasks/proposals", {
      token: await childToken(fam.childA, fam.familyId),
      body: CREATE_BODY,
      idempotencyKey: "prp-noledger-1",
    });
    expect(res.status).toBe(201);

    expect(await countTasks(fam.familyId)).toBe(0);
    expect(await countLedger(fam.familyId)).toBe(0);
    expect(await ledgerBalance(env.DB, fam.familyId, fam.childA)).toBe(0);
  });

  it("kind zonder tienerregister krijgt 403", async () => {
    const fam = await seedFamily("prp_mid");
    const res = await api("/tasks/proposals", {
      token: await childToken(fam.childA, fam.familyId), // seed = age_mode 'mid'
      body: CREATE_BODY,
      idempotencyKey: "prp-mid-1",
    });
    expect(res.status).toBe(403);
  });

  it("ouder kan geen taakvraag indienen (403)", async () => {
    const fam = await seedFamily("prp_parent_create");
    const res = await api("/tasks/proposals", {
      token: await parentToken(fam.parentId, fam.familyId),
      body: CREATE_BODY,
      idempotencyKey: "prp-parent-1",
    });
    expect(res.status).toBe(403);
  });

  it("zonder Idempotency-Key een 400", async () => {
    const fam = await seedFamily("prp_nokey");
    await makeTeen(fam.familyId, fam.childA);
    const res = await api("/tasks/proposals", {
      token: await childToken(fam.childA, fam.familyId),
      body: CREATE_BODY,
    });
    expect(res.status).toBe(400);
  });

  it("dezelfde Idempotency-Key levert één taakvraag op", async () => {
    const fam = await seedFamily("prp_idem_create");
    await makeTeen(fam.familyId, fam.childA);
    const token = await childToken(fam.childA, fam.familyId);

    const first = await api("/tasks/proposals", {
      token,
      body: CREATE_BODY,
      idempotencyKey: "prp-dedup-1",
    });
    const second = await api("/tasks/proposals", {
      token,
      body: CREATE_BODY,
      idempotencyKey: "prp-dedup-1",
    });
    expect(first.status).toBe(201);
    expect(second.status).toBe(200); // replay uit de KV-cache
    expect(((await first.json()) as { id: string }).id).toBe(
      ((await second.json()) as { id: string }).id,
    );

    const rows = await env.DB.prepare("SELECT COUNT(*) AS n FROM task_proposals WHERE family_id = ?")
      .bind(fam.familyId)
      .first<{ n: number }>();
    expect(rows?.n).toBe(1);
  });
});

// ============================================================
// GET /tasks/proposals — zichtbaarheid
// ============================================================

describe("GET /tasks/proposals", () => {
  it("ouder ziet alle taakvragen van het gezin", async () => {
    const fam = await seedFamily("prp_list_parent");
    await seedProposal(fam.familyId, fam.childA);
    await seedProposal(fam.familyId, fam.childB, "Hond uitlaten");

    const res = await api("/tasks/proposals", {
      token: await parentToken(fam.parentId, fam.familyId),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { proposals: Array<{ childId: string }> };
    expect(body.proposals).toHaveLength(2);
  });

  it("kind ziet alleen zijn eigen taakvragen", async () => {
    const fam = await seedFamily("prp_list_child");
    await seedProposal(fam.familyId, fam.childA);
    await seedProposal(fam.familyId, fam.childB, "Hond uitlaten");

    const res = await api("/tasks/proposals", {
      token: await childToken(fam.childA, fam.familyId),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { proposals: Array<{ childId: string }> };
    expect(body.proposals).toHaveLength(1);
    expect(body.proposals[0]!.childId).toBe(fam.childA);
  });

  it("filtert op status", async () => {
    const fam = await seedFamily("prp_list_status");
    const pendingId = await seedProposal(fam.familyId, fam.childA);
    const declinedId = await seedProposal(fam.familyId, fam.childA, "Ramen zemen");
    await env.DB.prepare("UPDATE task_proposals SET status = 'declined' WHERE id = ?")
      .bind(declinedId)
      .run();

    const res = await api("/tasks/proposals?status=pending", {
      token: await parentToken(fam.parentId, fam.familyId),
    });
    const body = (await res.json()) as { proposals: Array<{ id: string }> };
    expect(body.proposals).toHaveLength(1);
    expect(body.proposals[0]!.id).toBe(pendingId);
  });

  it("ziet geen taakvragen van een ander gezin", async () => {
    const famA = await seedFamily("prp_list_x_a");
    const famB = await seedFamily("prp_list_x_b");
    await seedProposal(famB.familyId, famB.childA);

    const res = await api("/tasks/proposals", {
      token: await parentToken(famA.parentId, famA.familyId),
    });
    const body = (await res.json()) as { proposals: unknown[] };
    expect(body.proposals).toHaveLength(0);
  });
});

// ============================================================
// POST /tasks/proposals/:id/approve
// ============================================================

describe("POST /tasks/proposals/:id/approve", () => {
  it("ouder full maakt er een echte taak van — zonder ledger-boeking", async () => {
    const fam = await seedFamily("prp_approve");
    const proposalId = await seedProposal(fam.familyId, fam.childA);

    const res = await api(`/tasks/proposals/${proposalId}/approve`, {
      token: await parentToken(fam.parentId, fam.familyId),
      body: { points: 15 }, // wijkt bewust af van suggested_points (20)
      idempotencyKey: "prp-approve-1",
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      proposal: { status: string; createdTaskId: string | null };
      taskId: string;
    };
    expect(body.proposal.status).toBe("approved");
    expect(body.proposal.createdTaskId).toBe(body.taskId);

    const task = await env.DB.prepare("SELECT * FROM tasks WHERE family_id = ? AND id = ?")
      .bind(fam.familyId, body.taskId)
      .first<{ title: string; points: number; assignees: string }>();
    expect(task?.title).toBe("Auto wassen");
    expect(task?.points).toBe(15);
    expect(JSON.parse(task!.assignees)).toEqual([fam.childA]);

    // Harde regel: goedkeuren van een taakvraag raakt het ledger nooit.
    expect(await countLedger(fam.familyId)).toBe(0);
    expect(await ledgerBalance(env.DB, fam.familyId, fam.childA)).toBe(0);
  });

  it("kind kan een taakvraag niet goedkeuren (403) en er ontstaat geen taak", async () => {
    const fam = await seedFamily("prp_approve_child");
    const proposalId = await seedProposal(fam.familyId, fam.childA);

    const res = await api(`/tasks/proposals/${proposalId}/approve`, {
      token: await childToken(fam.childA, fam.familyId),
      body: { points: 15 },
      idempotencyKey: "prp-approve-child-1",
    });
    expect(res.status).toBe(403);
    expect(await countTasks(fam.familyId)).toBe(0);
  });

  it("approve_only ouder kan niet goedkeuren (403)", async () => {
    const fam = await seedFamily("prp_approve_aonly");
    const proposalId = await seedProposal(fam.familyId, fam.childA);

    const res = await api(`/tasks/proposals/${proposalId}/approve`, {
      token: await parentToken(fam.parentId, fam.familyId, { perm: "approve_only" }),
      body: { points: 15 },
      idempotencyKey: "prp-approve-aonly-1",
    });
    expect(res.status).toBe(403);
  });

  it("ouder van een ander gezin krijgt 404 en maakt geen taak aan", async () => {
    const famA = await seedFamily("prp_approve_x_a");
    const famB = await seedFamily("prp_approve_x_b");
    const proposalId = await seedProposal(famB.familyId, famB.childA);

    const res = await api(`/tasks/proposals/${proposalId}/approve`, {
      token: await parentToken(famA.parentId, famA.familyId),
      body: { points: 15 },
      idempotencyKey: "prp-approve-x-1",
    });
    expect(res.status).toBe(404);
    expect(await countTasks(famA.familyId)).toBe(0);
    expect(await countTasks(famB.familyId)).toBe(0);

    const row = await env.DB.prepare("SELECT status FROM task_proposals WHERE id = ?")
      .bind(proposalId)
      .first<{ status: string }>();
    expect(row?.status).toBe("pending");
  });

  it("assignee uit een ander gezin wordt geweigerd (400)", async () => {
    const famA = await seedFamily("prp_assignee_x_a");
    const famB = await seedFamily("prp_assignee_x_b");
    const proposalId = await seedProposal(famA.familyId, famA.childA);

    const res = await api(`/tasks/proposals/${proposalId}/approve`, {
      token: await parentToken(famA.parentId, famA.familyId),
      body: { points: 15, assignees: [famB.childA] },
      idempotencyKey: "prp-assignee-x-1",
    });
    expect(res.status).toBe(400);
    expect(await countTasks(famA.familyId)).toBe(0);
  });

  it("dubbel goedkeuren met dezelfde Idempotency-Key levert één taak op", async () => {
    const fam = await seedFamily("prp_approve_idem");
    const proposalId = await seedProposal(fam.familyId, fam.childA);
    const token = await parentToken(fam.parentId, fam.familyId);

    const first = await api(`/tasks/proposals/${proposalId}/approve`, {
      token,
      body: { points: 15 },
      idempotencyKey: "prp-approve-dedup",
    });
    const second = await api(`/tasks/proposals/${proposalId}/approve`, {
      token,
      body: { points: 15 },
      idempotencyKey: "prp-approve-dedup",
    });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    const firstBody = (await first.json()) as { taskId: string };
    const secondBody = (await second.json()) as { taskId: string };
    expect(secondBody.taskId).toBe(firstBody.taskId);
    expect(await countTasks(fam.familyId)).toBe(1);
    expect(await countLedger(fam.familyId)).toBe(0);
  });

  it("tweede goedkeuring met een nieuwe Idempotency-Key geeft 409, geen tweede taak", async () => {
    const fam = await seedFamily("prp_approve_twice");
    const proposalId = await seedProposal(fam.familyId, fam.childA);
    const token = await parentToken(fam.parentId, fam.familyId);

    await api(`/tasks/proposals/${proposalId}/approve`, {
      token,
      body: { points: 15 },
      idempotencyKey: "prp-twice-1",
    });
    const second = await api(`/tasks/proposals/${proposalId}/approve`, {
      token,
      body: { points: 15 },
      idempotencyKey: "prp-twice-2",
    });

    expect(second.status).toBe(409);
    expect(await countTasks(fam.familyId)).toBe(1);
  });
});

// ============================================================
// POST /tasks/proposals/:id/decline
// ============================================================

describe("POST /tasks/proposals/:id/decline", () => {
  it("ouder full wijst af met een vriendelijke toelichting", async () => {
    const fam = await seedFamily("prp_decline");
    const proposalId = await seedProposal(fam.familyId, fam.childA);

    const res = await api(`/tasks/proposals/${proposalId}/decline`, {
      token: await parentToken(fam.parentId, fam.familyId),
      body: { note: "Goed idee! Deze bewaren we voor volgende week." },
      idempotencyKey: "prp-decline-1",
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      status: string;
      decisionNote: string | null;
      createdTaskId: string | null;
    };
    expect(body.status).toBe("declined");
    expect(body.decisionNote).toBe("Goed idee! Deze bewaren we voor volgende week.");
    expect(body.createdTaskId).toBeNull();
    expect(await countTasks(fam.familyId)).toBe(0);
    expect(await countLedger(fam.familyId)).toBe(0);
  });

  it("kind kan niet afwijzen (403)", async () => {
    const fam = await seedFamily("prp_decline_child");
    const proposalId = await seedProposal(fam.familyId, fam.childA);

    const res = await api(`/tasks/proposals/${proposalId}/decline`, {
      token: await childToken(fam.childA, fam.familyId),
      body: { note: "Nee" },
      idempotencyKey: "prp-decline-child-1",
    });
    expect(res.status).toBe(403);
  });

  it("afwijzen na goedkeuren geeft 409", async () => {
    const fam = await seedFamily("prp_decline_after");
    const proposalId = await seedProposal(fam.familyId, fam.childA);
    const token = await parentToken(fam.parentId, fam.familyId);

    await api(`/tasks/proposals/${proposalId}/approve`, {
      token,
      body: { points: 15 },
      idempotencyKey: "prp-decline-after-1",
    });
    const res = await api(`/tasks/proposals/${proposalId}/decline`, {
      token,
      body: { note: "Toch niet" },
      idempotencyKey: "prp-decline-after-2",
    });
    expect(res.status).toBe(409);
  });

  it("ouder van een ander gezin krijgt 404", async () => {
    const famA = await seedFamily("prp_decline_x_a");
    const famB = await seedFamily("prp_decline_x_b");
    const proposalId = await seedProposal(famB.familyId, famB.childA);

    const res = await api(`/tasks/proposals/${proposalId}/decline`, {
      token: await parentToken(famA.parentId, famA.familyId),
      body: { note: "Nee" },
      idempotencyKey: "prp-decline-x-1",
    });
    expect(res.status).toBe(404);
  });
});

// ============================================================
// Round-trip: van taakvraag naar zichtbare taak
// ============================================================

describe("taakvraag round-trip", () => {
  it("tiener dient in, ouder keurt goed, tiener ziet de status", async () => {
    const fam = await seedFamily("prp_roundtrip");
    await makeTeen(fam.familyId, fam.childA);
    const teenToken = await childToken(fam.childA, fam.familyId);
    const pToken = await parentToken(fam.parentId, fam.familyId);

    const created = await api("/tasks/proposals", {
      token: teenToken,
      body: CREATE_BODY,
      idempotencyKey: "prp-rt-1",
    });
    const { id } = (await created.json()) as { id: string };

    // Ouderrij toont de vraag
    const queue = await api("/tasks/proposals?status=pending", { token: pToken });
    expect(((await queue.json()) as { proposals: unknown[] }).proposals).toHaveLength(1);

    const approved = await api(`/tasks/proposals/${id}/approve`, {
      token: pToken,
      body: { points: 30, approvalRequired: true },
      idempotencyKey: "prp-rt-2",
    });
    expect(approved.status).toBe(200);

    // Tiener ziet zijn vraag nu als goedgekeurd, met de gemaakte taak eraan gekoppeld
    const mine = await api("/tasks/proposals", { token: teenToken });
    const body = (await mine.json()) as {
      proposals: Array<{ status: string; createdTaskId: string | null }>;
    };
    expect(body.proposals).toHaveLength(1);
    expect(body.proposals[0]!.status).toBe("approved");
    expect(body.proposals[0]!.createdTaskId).not.toBeNull();

    // En de taak staat in de takenlijst van de ouder
    const taskList = await api("/tasks", { token: pToken });
    const tasks = (await taskList.json()) as Array<{ title: string; points: number }>;
    expect(tasks).toHaveLength(1);
    expect(tasks[0]!.points).toBe(30);
  });
});
