"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  TaskProposalListResponse,
  ApproveProposalBody,
  DeclineProposalBody,
  type TaskProposal as TProposal,
} from "@taakhelden/shared";
import { MemberList, type MemberView } from "../../../../lib/api/types";
import { apiClient, ApiClientError } from "../../../../lib/api/client";
import { useRouter } from "../../../../i18n/navigation";
import { Button, Field, Input } from "../../../../components/ui";

function ProposalCard({
  proposal,
  childName,
  onResolve,
}: {
  proposal: TProposal;
  childName: string;
  onResolve: (id: string) => void;
}) {
  const t = useTranslations("goedkeuren.proposals");
  const [mode, setMode] = useState<"idle" | "approve" | "decline">("idle");
  const [points, setPoints] = useState(proposal.suggestedPoints);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nonce = useRef(crypto.randomUUID()).current;

  async function submitApprove(e: React.FormEvent) {
    e.preventDefault();
    const parsed = ApproveProposalBody.safeParse({ points, approvalRequired: false, assignees: [] });
    if (!parsed.success) {
      setError(t("approveValidationError"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiClient.post(
        `/api/v1/tasks/proposals/${proposal.id}/approve`,
        parsed.data,
        { idempotencyKey: `approve-proposal:${proposal.id}:${nonce}` },
      );
      onResolve(proposal.id);
    } catch {
      setError(t("actionError"));
      setBusy(false);
    }
  }

  async function submitDecline(e: React.FormEvent) {
    e.preventDefault();
    const parsed = DeclineProposalBody.safeParse({ note: note.trim() });
    if (!parsed.success) {
      setError(t("declineNoteRequired"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiClient.post(
        `/api/v1/tasks/proposals/${proposal.id}/decline`,
        parsed.data,
        { idempotencyKey: `decline-proposal:${proposal.id}:${nonce}` },
      );
      onResolve(proposal.id);
    } catch {
      setError(t("actionError"));
      setBusy(false);
    }
  }

  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center gap-2">
        {proposal.icon && <span aria-hidden>{proposal.icon}</span>}
        <h3 className="min-w-0 flex-1 truncate text-base font-semibold text-text">
          {proposal.title}
        </h3>
        <span className="text-sm font-medium text-muted">
          {t("suggestedPoints", { points: proposal.suggestedPoints })}
        </span>
      </div>
      <p className="mt-0.5 text-sm text-muted">{t("requestedBy", { name: childName })}</p>
      {proposal.note && (
        <p className="mt-2 rounded bg-bg px-3 py-2 text-sm italic text-muted">
          &ldquo;{proposal.note}&rdquo;
        </p>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}

      {mode === "idle" && (
        <div className="mt-3 flex gap-2">
          <Button type="button" onClick={() => setMode("approve")} disabled={busy}>
            {t("approve")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setMode("decline")}
            disabled={busy}
          >
            {t("decline")}
          </Button>
        </div>
      )}

      {mode === "approve" && (
        <form onSubmit={submitApprove} className="mt-3 flex flex-col gap-3">
          <Field label={t("pointsLabel")}>
            <Input
              type="number"
              name="points"
              min={1}
              max={500}
              required
              value={points}
              onChange={(e) => setPoints(Number(e.target.value))}
            />
          </Field>
          <div className="flex gap-2">
            <Button type="submit" disabled={busy || points < 1}>
              {busy ? t("approving") : t("approveConfirm")}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setMode("idle");
                setPoints(proposal.suggestedPoints);
                setError(null);
              }}
              disabled={busy}
            >
              {t("cancel")}
            </Button>
          </div>
        </form>
      )}

      {mode === "decline" && (
        <form onSubmit={submitDecline} className="mt-3 flex flex-col gap-2">
          <label className="text-sm font-medium text-text">
            {t("declineLabel")}
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              required
              maxLength={200}
              rows={2}
              placeholder={t("declinePlaceholder")}
              className="mt-1 w-full rounded border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </label>
          <div className="flex gap-2">
            <Button type="submit" disabled={busy || note.trim().length === 0}>
              {busy ? t("declining") : t("declineConfirm")}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setMode("idle");
                setNote("");
                setError(null);
              }}
              disabled={busy}
            >
              {t("cancel")}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}

export default function ProposalQueue() {
  const t = useTranslations("goedkeuren.proposals");
  const router = useRouter();
  const [proposals, setProposals] = useState<TProposal[] | null>(null);
  const [members, setMembers] = useState<MemberView[]>([]);
  const [failed, setFailed] = useState(false);
  const hadDataRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const [proposalsRaw, membersRaw] = await Promise.all([
        apiClient.get("/api/v1/tasks/proposals?status=pending"),
        apiClient.get("/api/v1/members"),
      ]);
      const parsed = TaskProposalListResponse.parse(proposalsRaw);
      setProposals(parsed.proposals);
      setMembers(MemberList.parse(membersRaw));
      hadDataRef.current = true;
      setFailed(false);
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 401) {
        router.push("/login");
        return;
      }
      if (!hadDataRef.current) setFailed(true);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  const resolve = useCallback((id: string) => {
    setProposals((prev) => (prev ? prev.filter((p) => p.id !== id) : prev));
  }, []);

  function childName(childId: string): string {
    const member = members.find((m) => m.id === childId);
    return member?.displayName ?? childId;
  }

  if (failed) return <p className="mt-2 text-sm text-danger">{t("loadError")}</p>;
  if (proposals === null) return null;
  if (proposals.length === 0) return null;

  return (
    <section aria-label={t("sectionLabel")} className="mt-8">
      <h2 className="text-base font-semibold text-text">{t("sectionLabel")}</h2>
      <p className="mt-0.5 text-sm text-muted">{t("sectionHint")}</p>
      <div
        className="mt-4 flex flex-col gap-4"
        aria-live="polite"
      >
        {proposals.map((p) => (
          <ProposalCard
            key={p.id}
            proposal={p}
            childName={childName(p.childId)}
            onResolve={resolve}
          />
        ))}
      </div>
    </section>
  );
}
