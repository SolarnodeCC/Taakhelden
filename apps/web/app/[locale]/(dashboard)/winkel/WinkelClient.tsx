"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { apiClient, ApiClientError } from "../../../../lib/api/client";
import {
  MemberList,
  RewardList,
  RedemptionList,
  type MemberView,
  type RewardView,
  type RewardFormPayload,
  type RedemptionView,
} from "../../../../lib/api/types";
import { displayIcon } from "../../../../lib/icons";
import { useRealtimeRefetch } from "../../../../lib/realtime/FamilyRealtimeContext";
import { SHOP_REALTIME_EVENTS } from "../../../../lib/realtime/events";
import { useRouter } from "../../../../i18n/navigation";
import {
  FullParentForbidden,
  FullParentUpstreamError,
  useRequireFullParent,
} from "../../../../lib/auth/RequireFullParent";
import { Alert, Button, Card, ConfirmDelete, EmptyState, PageError, SkeletonRows } from "../../../../components/ui";
import RewardForm from "./RewardForm";

type FormState = { mode: "create" } | { mode: "edit"; reward: RewardView } | null;

function RedemptionCard({
  redemption,
  childName,
  onFulfill,
  onCancel,
}: {
  redemption: RedemptionView;
  childName: string;
  onFulfill: () => Promise<void>;
  onCancel: () => Promise<void>;
}) {
  const t = useTranslations("winkel");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<void>, errorKey: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      const code = err instanceof ApiClientError ? err.code : null;
      if (code === "INSUFFICIENT_POINTS") {
        setError(t("errors.INSUFFICIENT_POINTS"));
      } else if (code === "REWARD_LIMIT_REACHED") {
        setError(t("errors.REWARD_LIMIT_REACHED"));
      } else {
        setError(t(errorKey));
      }
      setBusy(false);
    }
  }

  return (
    <Card as="li" variant="row">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {displayIcon(redemption.icon) && <span aria-hidden>{displayIcon(redemption.icon)}</span>}
            <span className="truncate text-sm font-semibold text-text">{redemption.title}</span>
          </div>
          <p className="mt-0.5 text-sm text-muted">
            {t("requestedBy", { name: childName })} · {t("price", { points: redemption.price })}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => run(onFulfill, "errors.fulfillFailed")}
            disabled={busy}
            className="rounded bg-accent px-3 py-1.5 text-sm font-semibold text-accent-fg transition-colors hover:bg-accent-hover disabled:opacity-60"
          >
            {t("fulfill")}
          </button>
          <button
            type="button"
            onClick={() => run(onCancel, "errors.cancelFailed")}
            disabled={busy}
            className="rounded border border-border px-3 py-1.5 text-sm font-medium text-text transition-colors hover:bg-bg disabled:opacity-60"
          >
            {t("cancelRequest")}
          </button>
        </div>
      </div>
      {error && (
        <div className="mt-3">
          <Alert tone="danger">{error}</Alert>
        </div>
      )}
    </Card>
  );
}

function RewardRow({
  reward,
  onEdit,
  onDelete,
  confirming,
  onConfirmDelete,
  onCancelDelete,
}: {
  reward: RewardView;
  onEdit: () => void;
  onDelete: () => void;
  confirming: boolean;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
}) {
  const t = useTranslations("winkel");
  return (
    <Card as="li" variant="row" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {displayIcon(reward.icon) && <span aria-hidden>{displayIcon(reward.icon)}</span>}
            <span className="truncate text-lg font-semibold text-text">{reward.title}</span>
          </div>
          <p className="mt-0.5 text-sm text-muted">
            {t("price", { points: reward.price })}
            {reward.limitPerWeek != null &&
              ` · ${t("limitPerWeek", { count: reward.limitPerWeek })}`}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex min-h-11 items-center rounded border border-border-interactive px-3 py-1.5 text-sm font-medium text-text transition-colors hover:bg-bg"
          >
            {t("edit")}
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex min-h-11 items-center rounded border border-border-interactive px-3 py-1.5 text-sm font-medium text-danger transition-colors hover:bg-bg"
          >
            {t("delete")}
          </button>
        </div>
      </div>
      {confirming && (
        <ConfirmDelete
          question={t("deleteConfirm")}
          onConfirm={onConfirmDelete}
          onCancel={onCancelDelete}
        />
      )}
    </Card>
  );
}

export default function WinkelClient() {
  const t = useTranslations("winkel");
  const router = useRouter();
  const gate = useRequireFullParent();
  const [rewards, setRewards] = useState<RewardView[] | null>(null);
  const [requests, setRequests] = useState<RedemptionView[]>([]);
  const [children, setChildren] = useState<MemberView[]>([]);
  const [failed, setFailed] = useState(false);
  const [form, setForm] = useState<FormState>(null);
  const [pendingDelete, setPendingDelete] = useState<RewardView | null>(null);
  const hadDataRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const [rewardsRaw, redemptionsRaw, membersRaw] = await Promise.all([
        apiClient.get("/api/v1/rewards"),
        apiClient.get("/api/v1/redemptions?status=pending"),
        apiClient.get("/api/v1/members"),
      ]);
      setRewards(RewardList.parse(rewardsRaw));
      setRequests(RedemptionList.parse(redemptionsRaw));
      setChildren(MemberList.parse(membersRaw).filter((m) => m.role === "child"));
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
    if (gate !== "ok") return;
    void load();
  }, [gate, load]);

  const loadWhenAllowed = useCallback(() => {
    if (gate === "ok") void load();
  }, [gate, load]);

  useRealtimeRefetch(SHOP_REALTIME_EVENTS, loadWhenAllowed);

  const childName = useCallback(
    (id: string) => children.find((c) => c.id === id)?.displayName ?? "—",
    [children],
  );

  if (gate === "forbidden") return <FullParentForbidden />;
  if (gate === "upstream_error") return <FullParentUpstreamError />;
  if (gate === "loading") return <p className="text-sm text-muted">{t("loading")}</p>;

  async function submit(payload: RewardFormPayload) {
    if (form?.mode === "edit") {
      await apiClient.patch(`/api/v1/rewards/${form.reward.id}`, payload);
    } else {
      await apiClient.post("/api/v1/rewards", payload);
    }
    setForm(null);
    await load();
  }

  async function removeReward(reward: RewardView) {
    try {
      await apiClient.delete(`/api/v1/rewards/${reward.id}`);
      setRewards((prev) => (prev ? prev.filter((x) => x.id !== reward.id) : prev));
      setPendingDelete(null);
    } catch {
      setFailed(true);
    }
  }

  // Fulfil/cancel both remove the request from the pending queue; the ledger
  // effect (points spent / refunded) is handled server-side via the FamilyRoom.
  // Idempotency keys are derived from action + id so double-taps dedup correctly.
  function resolveRequest(id: string, path: string) {
    return async () => {
      await apiClient.post(
        `/api/v1/redemptions/${id}/${path}`,
        undefined,
        { idempotencyKey: `${path}:${id}` },
      );
      setRequests((prev) => prev.filter((r) => r.id !== id));
    };
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold text-text">{t("title")}</h1>

      {failed && (
        <div className="mt-4">
          <PageError message={t("loadError")} onRetry={() => void load()} />
        </div>
      )}

      {/* Inwisselverzoeken — de actiegerichte wachtrij. */}
      <section className="mt-5">
        <h2 className="text-lg font-semibold text-text">{t("requestsHeading")}</h2>
        {requests.length === 0 ? (
          <p className="mt-2 text-sm text-muted">{t("noRequests")}</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-3">
            {requests.map((r) => (
              <RedemptionCard
                key={r.id}
                redemption={r}
                childName={childName(r.childId)}
                onFulfill={resolveRequest(r.id, "fulfill")}
                onCancel={resolveRequest(r.id, "cancel")}
              />
            ))}
          </ul>
        )}
      </section>

      {/* Beloningen beheren. */}
      <section className="mt-8">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-text">{t("rewardsHeading")}</h2>
          {form === null && (
            <Button type="button" onClick={() => setForm({ mode: "create" })}>
              {t("newReward")}
            </Button>
          )}
        </div>

        {form !== null && (
          <div className="mt-3">
            <RewardForm
              initial={form.mode === "edit" ? form.reward : undefined}
              onSubmit={submit}
              onCancel={() => setForm(null)}
            />
          </div>
        )}

        {!failed && rewards === null && (
          <div className="mt-3" aria-busy>
            <SkeletonRows count={2} />
          </div>
        )}

        {rewards !== null && rewards.length === 0 && form === null && (
          <div className="mt-3">
            <EmptyState
              title={t("noRewardsTitle")}
              body={t("noRewards")}
              action={
                <Button type="button" onClick={() => setForm({ mode: "create" })}>
                  {t("newReward")}
                </Button>
              }
            />
          </div>
        )}

        {rewards !== null && rewards.length > 0 && (
          <ul className="mt-3 flex flex-col gap-3">
            {rewards.map((reward) => (
              <RewardRow
                key={reward.id}
                reward={reward}
                onEdit={() => setForm({ mode: "edit", reward })}
                onDelete={() => setPendingDelete(reward)}
                confirming={pendingDelete?.id === reward.id}
                onConfirmDelete={() => void removeReward(reward)}
                onCancelDelete={() => setPendingDelete(null)}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
