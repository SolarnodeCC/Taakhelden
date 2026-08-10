/**
 * WS-PROPOSAL — Taakvraag.
 *
 * Een tiener stelt een taak voor; een ouder keurt die goed tot een echte taak
 * of wijst hem vriendelijk af. Een taakvraag raakt het ledger nooit: punten
 * stromen pas via de normale taak → afvinken → goedkeuren-route.
 *
 * Leeftijdsgrens: het voorstel is bedoeld voor tieners (workstream-spec:
 * "default: teen only"). We handhaven dat serverside op `users.age_mode`, met
 * `birth_year` als correctie — `age_mode` wordt bij aanmaken afgeleid en niet
 * bijgewerkt, dus een kind dat inmiddels 13 is mag ook zonder profielwijziging
 * een taakvraag stellen.
 */
import { Hono } from "hono";
import {
  ApproveProposalBody,
  CreateProposalBody,
  DeclineProposalBody,
  ErrorCodes,
  ProposalStatus,
  TaskProposal,
  TaskProposalListResponse,
} from "@taakhelden/shared";
import type { AppBindings } from "../types";
import { ApiException } from "../middleware/error";
import { requireParent } from "../middleware/authz";
import { validate } from "../middleware/validate";
import { requireIdempotencyKey } from "../middleware/idempotency";
import {
  createProposal,
  decideProposal,
  getProposal,
  listProposals,
  type ProposalRow,
} from "../repo/proposals";
import { archiveTask, createTask } from "../repo/tasks";
import { getFamily, getMember, listChildren } from "../repo/families";
import { generateInstancesForFamily } from "../services/taskEngine";
import { childCopy, notifyChild } from "../services/notifier";
import { localDate } from "../services/time";
import { screenProposalText } from "../services/proposalScreen";

const proposals = new Hono<AppBindings>();

const TEEN_MIN_AGE = 13;

/**
 * `includeReviewFlag` is de enige plek die bepaalt of `review_flag` het
 * netwerk op gaat. Een kind mag NOOIT zien dat zijn eigen taakvraag gemarkeerd
 * is (WS-AI-GUARD AC2) — dus elke call-site hieronder geeft dit expliciet mee,
 * er is geen "veilige default".
 */
function proposalView(row: ProposalRow, includeReviewFlag: boolean): TaskProposal {
  return TaskProposal.parse({
    id: row.id,
    childId: row.child_id,
    title: row.title,
    category: row.category,
    icon: row.icon,
    suggestedPoints: row.suggested_points,
    note: row.note ?? null,
    status: row.status,
    decisionNote: row.decision_note ?? null,
    decidedAt: row.decided_at ?? null,
    createdTaskId: row.created_task_id ?? null,
    createdAt: row.created_at,
    ...(includeReviewFlag ? { reviewFlag: row.review_flag ?? null } : {}),
  });
}

/** Mag dit kind een taakvraag stellen? Tienerregister: age_mode 'teen' of 13+. */
function isTeen(member: Record<string, unknown>): boolean {
  if (member.age_mode === "teen") return true;
  const birthYear = typeof member.birth_year === "number" ? member.birth_year : null;
  return birthYear !== null && new Date().getFullYear() - birthYear >= TEEN_MIN_AGE;
}

/** POST /tasks/proposals — kind (tiener) stelt een taak voor. Geen punten, geen ledger. */
proposals.post("/", requireIdempotencyKey, validate("json", CreateProposalBody), async (c) => {
  const auth = c.get("auth");
  if (auth.role !== "child") {
    throw new ApiException(403, ErrorCodes.FORBIDDEN, "Alleen kinderen kunnen een taak aanvragen.");
  }

  const member = await getMember(c.env.DB, auth.familyId, auth.userId);
  if (!member || member.role !== "child") {
    throw new ApiException(404, ErrorCodes.NOT_FOUND, "Kindprofiel niet gevonden.");
  }
  if (!isTeen(member as Record<string, unknown>)) {
    throw new ApiException(
      403,
      ErrorCodes.FORBIDDEN,
      "Taakvragen kun je vanaf 13 jaar sturen. Vertel je idee zolang even aan je ouder — dat werkt ook!",
    );
  }

  const body = c.req.valid("json");
  const reviewFlag = screenProposalText(body.title, body.note);

  const id = await createProposal(c.env.DB, auth.familyId, {
    ...body,
    childId: auth.userId,
    reviewFlag,
  });
  const row = await getProposal(c.env.DB, auth.familyId, id);
  if (!row) {
    throw new ApiException(404, ErrorCodes.NOT_FOUND, "Taakvraag niet gevonden.");
  }
  // Het kind is de indiener van deze taakvraag: nooit zijn eigen vlag terugzien.
  return c.json(proposalView(row, false), 201);
});

/** GET /tasks/proposals?status=pending — ouder ziet alle vragen, kind alleen zijn eigen. */
proposals.get("/", async (c) => {
  const auth = c.get("auth");
  const statusParam = c.req.query("status");
  const parsedStatus = statusParam ? ProposalStatus.safeParse(statusParam) : null;
  if (parsedStatus && !parsedStatus.success) {
    throw new ApiException(400, ErrorCodes.VALIDATION_FAILED, "Onbekende status.");
  }

  const rows = await listProposals(c.env.DB, auth.familyId, {
    status: parsedStatus?.success ? parsedStatus.data : undefined,
    childId: auth.role === "child" ? auth.userId : undefined,
  });
  const includeReviewFlag = auth.role === "parent";
  return c.json(
    TaskProposalListResponse.parse({
      proposals: rows.map((row) => proposalView(row, includeReviewFlag)),
    }),
  );
});

/**
 * POST /tasks/proposals/{id}/approve — ouder (`full`) maakt er een echte taak van.
 * De ouder bepaalt de punten; die mogen afwijken van de suggestie.
 * Geen ledger-schrijfactie: de nieuwe taak verdient punten via de normale route.
 */
proposals.post(
  "/:id/approve",
  requireIdempotencyKey,
  validate("json", ApproveProposalBody),
  async (c) => {
    const { familyId, userId } = requireParent(c, { full: true });
    const proposalId = c.req.param("id");
    const body = c.req.valid("json");

    const proposal = await getProposal(c.env.DB, familyId, proposalId);
    if (!proposal) {
      throw new ApiException(404, ErrorCodes.NOT_FOUND, "Taakvraag niet gevonden.");
    }
    if (proposal.status !== "pending") {
      throw new ApiException(409, ErrorCodes.INVALID_STATUS, "Deze taakvraag is al beoordeeld.");
    }

    // Lege assignees = de indiener zelf; opgegeven assignees moeten kinderen
    // van dit gezin zijn (anders lekt een taak naar een ander gezin).
    const children = await listChildren(c.env.DB, familyId);
    const childIds = new Set(children.map((row) => (row as { id: string }).id));
    const assignees = body.assignees.length > 0 ? body.assignees : [proposal.child_id];
    if (assignees.some((id) => !childIds.has(id))) {
      throw new ApiException(400, ErrorCodes.VALIDATION_FAILED, "Onbekend kind in de taakverdeling.");
    }

    const family = ((await getFamily(c.env.DB, familyId)) ?? {}) as Record<string, unknown>;
    const today = localDate(
      typeof family.timezone === "string" ? family.timezone : "Europe/Amsterdam",
    );

    const taskId = await createTask(c.env.DB, familyId, {
      title: proposal.title,
      category: proposal.category as "household" | "homework" | "selfcare" | "custom",
      icon: proposal.icon,
      points: body.points,
      photoBonusPoints: 0,
      approvalRequired: body.approvalRequired,
      assignees,
      recurrence: null,
      daypart: null,
      activeFrom: today,
      activeUntil: null,
    });

    // Atomaire claim: verliest deze race (dubbele goedkeuring met verschillende
    // Idempotency-Keys), dan archiveren we de zojuist gemaakte taak weer — er
    // bestaan op dat moment nog geen instances voor.
    const decided = await decideProposal(c.env.DB, familyId, proposalId, {
      status: "approved",
      decidedBy: userId,
      createdTaskId: taskId,
    });
    if (!decided) {
      await archiveTask(c.env.DB, familyId, taskId);
      throw new ApiException(409, ErrorCodes.INVALID_STATUS, "Deze taakvraag is al beoordeeld.");
    }

    // Net als POST /tasks: staat de taak vandaag al aan de beurt, dan meteen een
    // instance — niet wachten op de nachtelijke cron.
    await generateInstancesForFamily(c.env.DB, familyId, family, today);

    // Push is best-effort: notifyChild respecteert quiet hours en de dagelijkse
    // limiet, en is een no-op zonder APNs-secrets. Een pushfout mag de mutatie
    // nooit laten falen.
    try {
      await notifyChild(c.env, familyId, proposal.child_id, childCopy.taskOpen(proposal.title, body.points), {
        type: "task_open",
        refId: taskId,
        childId: proposal.child_id,
      });
    } catch {
      // stil: de taakvraag is goedgekeurd, de push is bijzaak
    }

    const updated = await getProposal(c.env.DB, familyId, proposalId);
    return c.json({ proposal: proposalView(updated as ProposalRow, true), taskId });
  },
);

/** POST /tasks/proposals/{id}/decline — ouder (`full`) wijst af met een vriendelijke toelichting. */
proposals.post(
  "/:id/decline",
  requireIdempotencyKey,
  validate("json", DeclineProposalBody),
  async (c) => {
    const { familyId, userId } = requireParent(c, { full: true });
    const proposalId = c.req.param("id");

    const proposal = await getProposal(c.env.DB, familyId, proposalId);
    if (!proposal) {
      throw new ApiException(404, ErrorCodes.NOT_FOUND, "Taakvraag niet gevonden.");
    }

    const decided = await decideProposal(c.env.DB, familyId, proposalId, {
      status: "declined",
      decidedBy: userId,
      decisionNote: c.req.valid("json").note,
    });
    if (!decided) {
      throw new ApiException(409, ErrorCodes.INVALID_STATUS, "Deze taakvraag is al beoordeeld.");
    }

    const updated = await getProposal(c.env.DB, familyId, proposalId);
    return c.json(proposalView(updated as ProposalRow, true));
  },
);

export default proposals;
