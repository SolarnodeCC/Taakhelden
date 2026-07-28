"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { AdjustBody, type Balance } from "@taakhelden/shared";
import { apiClient, ApiClientError } from "../../../../lib/api/client";
import {
  LedgerPage,
  MemberView,
  ParentBalancesResponse,
  parentBalancesChildren,
} from "../../../../lib/api/types";
import { avatarEmoji } from "../../../../lib/avatars";
import { Alert, Button, Field, Input } from "../../../../components/ui";

interface Props {
  child: MemberView;
  onClose: () => void;
}

export default function PointsPanel({ child, onClose }: Props) {
  const t = useTranslations("punten");
  const locale = useLocale();

  const [balance, setBalance] = useState<Balance | null>(null);
  const [entries, setEntries] = useState<LedgerPage["entries"]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [amount, setAmount] = useState(10);
  const [note, setNote] = useState("");
  const [adjustBusy, setAdjustBusy] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);
  const [adjustSuccess, setAdjustSuccess] = useState(false);

  const dateFmt = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const loadBalance = useCallback(async () => {
    const raw = await apiClient.get("/api/v1/points/balance");
    const parsed = ParentBalancesResponse.parse(raw);
    const match = parentBalancesChildren(parsed).find((b) => b.childId === child.id);
    setBalance(match ?? null);
  }, [child.id]);

  const loadLedger = useCallback(
    async (cursor?: string) => {
      const qs = new URLSearchParams({ childId: child.id, limit: "50" });
      if (cursor) qs.set("cursor", cursor);
      const raw = await apiClient.get(`/api/v1/points/ledger?${qs.toString()}`);
      return LedgerPage.parse(raw);
    },
    [child.id],
  );

  const refresh = useCallback(async () => {
    setLoadError(false);
    try {
      const [, page] = await Promise.all([loadBalance(), loadLedger()]);
      setEntries(page.entries);
      setNextCursor(page.nextCursor);
    } catch {
      setLoadError(true);
    }
  }, [loadBalance, loadLedger]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function loadMore() {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      const page = await loadLedger(nextCursor);
      setEntries((prev) => [...prev, ...page.entries]);
      setNextCursor(page.nextCursor);
    } catch {
      setLoadError(true);
    } finally {
      setLoadingMore(false);
    }
  }

  async function onAdjust(e: React.FormEvent) {
    e.preventDefault();
    setAdjustError(null);
    setAdjustSuccess(false);

    const body = { childId: child.id, amount, note: note.trim() };
    const parsed = AdjustBody.safeParse(body);
    if (!parsed.success) {
      setAdjustError(t("adjust.errorValidation"));
      return;
    }

    setAdjustBusy(true);
    try {
      await apiClient.post("/api/v1/points/adjust", parsed.data);
      setNote("");
      setAdjustSuccess(true);
      await refresh();
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 403) {
        setAdjustError(t("adjust.errorForbidden"));
      } else {
        setAdjustError(t("adjust.errorSave"));
      }
    } finally {
      setAdjustBusy(false);
    }
  }

  const emoji = avatarEmoji(child.avatarId);

  return (
    <div className="mt-3 rounded-lg border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          {emoji && (
            <span className="text-xl" aria-hidden>
              {emoji}
            </span>
          )}
          <div>
            <h3 className="text-base font-semibold text-text">
              {t("title", { name: child.displayName })}
            </h3>
            {balance && (
              <p className="mt-0.5 text-sm text-muted">
                {t("balance", { points: balance.balance })}
                {" · "}
                {t("streak", { days: balance.streakDays })}
              </p>
            )}
          </div>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          {t("close")}
        </Button>
      </div>

      {loadError && (
        <div className="mt-3">
          <Alert tone="danger">{t("loadError")}</Alert>
        </div>
      )}

      <section className="mt-4" aria-labelledby="ledger-heading">
        <h4 id="ledger-heading" className="text-sm font-semibold text-text">
          {t("ledgerTitle")}
        </h4>
        {entries.length === 0 && !loadError ? (
          <p className="mt-2 text-sm text-muted">{t("ledgerEmpty")}</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="flex items-start justify-between gap-3 rounded bg-bg px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium text-text">{t(`ledgerType.${entry.type}`)}</p>
                  {entry.note && <p className="mt-0.5 text-muted">{entry.note}</p>}
                  <p className="mt-0.5 text-xs text-muted">{dateFmt.format(new Date(entry.at))}</p>
                </div>
                <span className="shrink-0 font-semibold text-accent">+{entry.amount}</span>
              </li>
            ))}
          </ul>
        )}
        {nextCursor && (
          <div className="mt-3">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={loadingMore}
              onClick={() => void loadMore()}
            >
              {loadingMore ? t("loadingMore") : t("loadMore")}
            </Button>
          </div>
        )}
      </section>

      <section className="mt-6 border-t border-border pt-4" aria-labelledby="adjust-heading">
        <h4 id="adjust-heading" className="text-sm font-semibold text-text">
          {t("adjust.title")}
        </h4>
        <p className="mt-1 text-xs text-muted">{t("adjust.hint")}</p>

        <form onSubmit={onAdjust} className="mt-3 flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={t("adjust.amount")}>
              <Input
                type="number"
                min={1}
                max={1000}
                step={1}
                required
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
              />
            </Field>
            <Field label={t("adjust.note")}>
              <Input
                required
                maxLength={200}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t("adjust.notePlaceholder")}
              />
            </Field>
          </div>

          {adjustError && <Alert tone="danger">{adjustError}</Alert>}
          {adjustSuccess && !adjustError && <Alert tone="success">{t("adjust.success")}</Alert>}

          <div>
            <Button type="submit" size="sm" disabled={adjustBusy}>
              {adjustBusy ? t("adjust.saving") : t("adjust.submit")}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
