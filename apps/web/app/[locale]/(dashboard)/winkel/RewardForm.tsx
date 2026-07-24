"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { RewardView, RewardFormPayload } from "../../../../lib/api/types";
import { Button, Alert } from "../../../../components/ui";

const fieldClass =
  "mt-1 w-full rounded border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent";

interface Props {
  initial?: RewardView;
  onSubmit: (payload: RewardFormPayload) => Promise<void>;
  onCancel: () => void;
}

export default function RewardForm({ initial, onSubmit, onCancel }: Props) {
  const t = useTranslations("winkel.form");

  const [title, setTitle] = useState(initial?.title ?? "");
  const [icon, setIcon] = useState(initial?.icon ?? "gift");
  const [price, setPrice] = useState(initial?.price ?? 50);
  const [limited, setLimited] = useState((initial?.limitPerWeek ?? null) !== null);
  const [limitPerWeek, setLimitPerWeek] = useState(initial?.limitPerWeek ?? 1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await onSubmit({
        title: title.trim(),
        icon: icon.trim() || "gift",
        price,
        limitPerWeek: limited ? limitPerWeek : null,
      });
    } catch {
      setError(t("errorSave"));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-border bg-surface p-4">
      <h2 className="text-base font-semibold text-text">
        {initial ? t("editTitle") : t("createTitle")}
      </h2>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium text-text sm:col-span-2">
          {t("fldTitle")}
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={60}
            className={fieldClass}
          />
        </label>

        <label className="text-sm font-medium text-text">
          {t("fldIcon")}
          <input value={icon} onChange={(e) => setIcon(e.target.value)} className={fieldClass} />
        </label>

        <label className="text-sm font-medium text-text">
          {t("fldPrice")}
          <input
            type="number"
            min={1}
            max={10000}
            value={price}
            onChange={(e) => setPrice(Number(e.target.value))}
            required
            className={fieldClass}
          />
        </label>
      </div>

      <label className="mt-3 flex items-center gap-2 text-sm font-medium text-text">
        <input type="checkbox" checked={limited} onChange={(e) => setLimited(e.target.checked)} />
        {t("fldLimited")}
      </label>

      {limited && (
        <label className="mt-2 block text-sm font-medium text-text sm:max-w-[12rem]">
          {t("fldLimitPerWeek")}
          <input
            type="number"
            min={1}
            value={limitPerWeek}
            onChange={(e) => setLimitPerWeek(Number(e.target.value))}
            className={fieldClass}
          />
        </label>
      )}

      {error && <div className="mt-3"><Alert tone="danger">{error}</Alert></div>}

      <div className="mt-4 flex gap-2">
        <Button type="submit" disabled={busy}>
          {busy ? t("saving") : t("save")}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={busy}>
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}
