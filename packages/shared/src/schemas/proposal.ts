import { z } from "zod";
import { TaskCategory } from "./task";

/**
 * WS-PROPOSAL — Taakvraag. Een tiener stelt een taak voor, een ouder keurt die
 * goed tot een echte taak of wijst hem vriendelijk af.
 *
 * Een taakvraag levert nooit punten op: pas de goedgekeurde taak verdient
 * punten via de normale taak → afvinken → goedkeuren-route.
 */
export const ProposalStatus = z.enum(["pending", "approved", "declined"]);
export type ProposalStatus = z.infer<typeof ProposalStatus>;

/** POST /tasks/proposals — kind stelt een taak voor. */
export const CreateProposalBody = z.object({
  title: z.string().min(1).max(80),
  category: TaskCategory.default("household"),
  icon: z.string().min(1).max(24).default("star"),
  suggestedPoints: z.number().int().min(1).max(100),
  note: z.string().max(200).optional(),
});
export type CreateProposalBody = z.infer<typeof CreateProposalBody>;

/**
 * POST /tasks/proposals/{id}/approve — de ouder bepaalt de definitieve punten;
 * die mogen afwijken van `suggestedPoints`. Lege `assignees` = alleen de indiener.
 */
export const ApproveProposalBody = z.object({
  points: z.number().int().min(1).max(100),
  approvalRequired: z.boolean().default(false),
  assignees: z.array(z.string()).default([]),
});
export type ApproveProposalBody = z.infer<typeof ApproveProposalBody>;

/** POST /tasks/proposals/{id}/decline — altijd mét een vriendelijke toelichting. */
export const DeclineProposalBody = z.object({
  note: z.string().min(1).max(200),
});
export type DeclineProposalBody = z.infer<typeof DeclineProposalBody>;

export const TaskProposal = z.object({
  id: z.string(),
  childId: z.string(),
  title: z.string(),
  category: z.string(),
  icon: z.string(),
  suggestedPoints: z.number().int(),
  note: z.string().nullable(),
  status: ProposalStatus,
  /** Vriendelijke toelichting van de ouder bij een afwijzing. */
  decisionNote: z.string().nullable(),
  decidedAt: z.string().nullable(),
  createdTaskId: z.string().nullable(),
  createdAt: z.string(),
});
export type TaskProposal = z.infer<typeof TaskProposal>;

/** GET /tasks/proposals — ouder ziet alles, kind alleen zijn eigen vragen. */
export const TaskProposalListResponse = z.object({
  proposals: z.array(TaskProposal),
});
export type TaskProposalListResponse = z.infer<typeof TaskProposalListResponse>;
