/**
 * ENIGE laag met SQL voor taakvragen (WS-PROPOSAL / Taakvraag).
 * familyId is het eerste argument ná de DB-handle — security-grens (CLAUDE.md regel 1).
 * Taakvragen raken het ledger NOOIT (architectuurregel 3/4).
 */
import type { CreateProposalBody, ProposalStatus } from "@taakhelden/shared";
import { newId } from "../services/ids";

export interface ProposalRow {
  id: string;
  family_id: string;
  child_id: string;
  title: string;
  category: string;
  icon: string;
  suggested_points: number;
  note: string | null;
  status: ProposalStatus;
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string | null;
  created_task_id: string | null;
  created_at: string;
  /** WS-AI-GUARD (ADR-0006): NULL = geen vlag; ouder-only, zie `proposalView`. */
  review_flag: string | null;
}

/** Nieuwe taakvraag van een kind. Levert geen punten op en maakt geen taak aan. */
export async function createProposal(
  db: D1Database,
  familyId: string,
  input: CreateProposalBody & { childId: string; reviewFlag?: string | null },
): Promise<string> {
  const id = newId("prp");
  await db
    .prepare(
      `INSERT INTO task_proposals (id, family_id, child_id, title, category, icon, suggested_points, note, review_flag)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      familyId,
      input.childId,
      input.title,
      input.category,
      input.icon,
      input.suggestedPoints,
      input.note ?? null,
      input.reviewFlag ?? null,
    )
    .run();
  return id;
}

/** Taakvragen van het gezin; `childId` beperkt tot één kind (kind ziet alleen zichzelf). */
export async function listProposals(
  db: D1Database,
  familyId: string,
  filter: { status?: ProposalStatus; childId?: string } = {},
): Promise<ProposalRow[]> {
  // Four static SQL strings (no `${…}` interpolation) so scanners don't treat
  // this as string-built SQL. Filter values are still bound parameters only.
  if (filter.status && filter.childId) {
    const { results } = await db
      .prepare(
        `SELECT * FROM task_proposals
         WHERE family_id = ? AND status = ? AND child_id = ?
         ORDER BY created_at DESC, id DESC`,
      )
      .bind(familyId, filter.status, filter.childId)
      .all<ProposalRow>();
    return results;
  }
  if (filter.status) {
    const { results } = await db
      .prepare(
        `SELECT * FROM task_proposals
         WHERE family_id = ? AND status = ?
         ORDER BY created_at DESC, id DESC`,
      )
      .bind(familyId, filter.status)
      .all<ProposalRow>();
    return results;
  }
  if (filter.childId) {
    const { results } = await db
      .prepare(
        `SELECT * FROM task_proposals
         WHERE family_id = ? AND child_id = ?
         ORDER BY created_at DESC, id DESC`,
      )
      .bind(familyId, filter.childId)
      .all<ProposalRow>();
    return results;
  }
  const { results } = await db
    .prepare(
      `SELECT * FROM task_proposals
       WHERE family_id = ?
       ORDER BY created_at DESC, id DESC`,
    )
    .bind(familyId)
    .all<ProposalRow>();
  return results;
}

export async function getProposal(
  db: D1Database,
  familyId: string,
  proposalId: string,
): Promise<ProposalRow | null> {
  return db
    .prepare("SELECT * FROM task_proposals WHERE family_id = ? AND id = ?")
    .bind(familyId, proposalId)
    .first<ProposalRow>();
}

/**
 * Beslist een taakvraag. De guard `status = 'pending'` maakt dit een atomaire
 * claim: een tweede beslissing wijzigt niets en geeft `false` terug, zodat
 * dubbel goedkeuren nooit twee taken oplevert.
 */
export async function decideProposal(
  db: D1Database,
  familyId: string,
  proposalId: string,
  decision: {
    status: Exclude<ProposalStatus, "pending">;
    decidedBy: string;
    decisionNote?: string | null;
    createdTaskId?: string | null;
  },
): Promise<boolean> {
  const res = await db
    .prepare(
      `UPDATE task_proposals
       SET status = ?,
           decided_by = ?,
           decided_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
           decision_note = ?,
           created_task_id = ?
       WHERE family_id = ? AND id = ? AND status = 'pending'`,
    )
    .bind(
      decision.status,
      decision.decidedBy,
      decision.decisionNote ?? null,
      decision.createdTaskId ?? null,
      familyId,
      proposalId,
    )
    .run();
  return (res.meta.changes ?? 0) > 0;
}
