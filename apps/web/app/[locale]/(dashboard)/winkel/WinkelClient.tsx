"use client";

import { useCallback, useEffect, useState } from "react";
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
import { useRouter } from "../../../../i18n/navigation";
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

  async function run(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface p-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {redemption.icon && <span aria-hidden>{redemption.icon}</span>}
          <span className="truncate text-sm font-semibold text-text">{redemption.title}</span>
        </div>
        <p className="mt-0.5 text-sm text-muted">
          {t("requestedBy", { name: childName })} · {t("price", { points: redemption.price })}
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={() => run(onFulfill)}
          disabled={busy}
          className="rounded bg-accent px-3 py-1.5 text-sm font-semibold text-accent-fg transition-colors hover:bg-accent-hover disabled:opacity-60"
        >
          {t("fulfill")}
        </button>
        <button
          type="button"
          onClick={() => run(onCancel)}
          disabled={busy}
          className="rounded border border-border px-3 py-1.5 text-sm font-medium text-text transition-colors hover:bg-bg disabled:opacity-60"
        >
          {t("cancelRequest")}
        </button>
      </div>
    </li>
  );
}

function RewardRow({
  reward,
  onEdit,
  onDelete,
}: {
  reward: RewardView;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations("winkel");
  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface p-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {reward.icon && <span aria-hidden>{reward.icon}</span>}
          <span className="truncate text-base font-semibold text-text">{reward.title}</span>
        </div>
        <p className="mt-0.5 text-sm text-muted">
          {t("price", { points: reward.price })}
          {reward.limitPerWeek != null && ` · ${t("limitPerWeek", { count: reward.limitPerWeek })}`}
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={onEdit}
          className="rounded border border-border px-3 py-1.5 text-sm font-medium text-text transition-colors hover:bg-bg"
        >
          {t("edit")}
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="rounded border border-border px-3 py-1.5 text-sm font-medium text-danger transition-colors hover:bg-bg"
        >
          {t("delete")}
        </button>
      </div>
    </li>
  );
}

export default function WinkelClient() {
  const t = useTranslations("winkel");
  const router = useRouter();
  const [rewards, setRewards] = useState<RewardView[] | null>(null);
  const [requests, setRequests] = useState<RedemptionView[]>([]);
  const [children, setChildren] = useState<MemberView[]>([]);
  const [failed, setFailed] = useState(false);
  const [form, setForm] = useState<FormState>(null);

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
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 401) {
        router.push("/login");
        return;
      }
      setFailed(true);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  const childName = useCallback(
    (id: string) => children.find((c) => c.id === id)?.displayName ?? "—",
    [children],
  );

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
    if (!window.confirm(t("deleteConfirm"))) return;
    try {
      await apiClient.delete(`/api/v1/rewards/${reward.id}`);
      setRewards((prev) => (prev ? prev.filter((x) => x.id !== reward.id) : prev));
    } catch {
      setFailed(true);
    }
  }

  // Fulfil/cancel both remove the request from the pending queue; the ledger
  // effect (points spent / refunded) is handled server-side via the FamilyRoom.
  function resolveRequest(id: string, path: string) {
    return async () => {
      await apiClient.post(`/api/v1/redemptions/${id}/${path}`);
      setRequests((prev) => prev.filter((r) => r.id !== id));
    };
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-semibold text-text">{t("title")}</h1>

      {failed && <p className="mt-4 text-sm text-danger">{t("loadError")}</p>}

      {/* Inwisselverzoeken — de actiegerichte wachtrij. */}
      <section className="mt-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          {t("requestsHeading")}
        </h2>
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
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            {t("rewardsHeading")}
          </h2>
          {form === null && (
            <button
              type="button"
              onClick={() => setForm({ mode: "create" })}
              className="rounded bg-accent px-4 py-2 text-sm font-semibold text-accent-fg transition-colors hover:bg-accent-hover"
            >
              {t("newReward")}
            </button>
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

        {!failed && rewards === null && <p className="mt-3 text-sm text-muted">{t("loading")}</p>}

        {rewards !== null && rewards.length === 0 && form === null && (
          <p className="mt-3 text-sm text-muted">{t("noRewards")}</p>
        )}

        {rewards !== null && rewards.length > 0 && (
          <ul className="mt-3 flex flex-col gap-3">
            {rewards.map((reward) => (
              <RewardRow
                key={reward.id}
                reward={reward}
                onEdit={() => setForm({ mode: "edit", reward })}
                onDelete={() => removeReward(reward)}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
