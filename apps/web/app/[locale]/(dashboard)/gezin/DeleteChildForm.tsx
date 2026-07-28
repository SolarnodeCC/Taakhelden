"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { apiClient, ApiClientError } from "../../../../lib/api/client";
import { MemberView } from "../../../../lib/api/types";
import { Alert, Button } from "../../../../components/ui";

interface Props {
  child: MemberView;
  busy: boolean;
  onCancel: () => void;
  onDeleted: () => Promise<void>;
}

export default function DeleteChildForm({ child, busy, onCancel, onDeleted }: Props) {
  const t = useTranslations("gezin.deleteChild");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!confirmed) {
      setError(t("confirmRequired"));
      return;
    }

    setDeleting(true);
    try {
      await apiClient.delete(`/api/v1/members/${child.id}`);
      await onDeleted();
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 403) {
        setError(t("errorForbidden"));
      } else {
        setError(t("errorDelete"));
      }
    } finally {
      setDeleting(false);
    }
  }

  const isBusy = busy || deleting;

  return (
    <form onSubmit={onSubmit} className="mt-3 rounded-lg border border-danger/40 bg-danger/5 p-4">
      <h3 className="text-base font-semibold text-text">{t("title", { name: child.displayName })}</h3>
      <p className="mt-1 text-sm text-muted">{t("hint")}</p>

      <label className="mt-4 flex items-start gap-2 text-sm text-text">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="mt-1"
        />
        <span>{t("confirm", { name: child.displayName })}</span>
      </label>

      {error && (
        <div className="mt-3">
          <Alert tone="danger">{error}</Alert>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="submit" variant="danger" size="sm" disabled={isBusy}>
          {isBusy ? t("deleting") : t("submit")}
        </Button>
        <Button type="button" variant="secondary" size="sm" disabled={isBusy} onClick={onCancel}>
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}
