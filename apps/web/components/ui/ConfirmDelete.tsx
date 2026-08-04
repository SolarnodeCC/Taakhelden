"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Button } from "./Button";

/**
 * Inline confirmation for a destructive action, replacing `window.confirm`.
 *
 * The native dialog could not be styled or localised beyond its message, broke
 * the calm parent register with OS chrome, and is suppressed outright in some
 * embedded contexts. This keeps the decision next to the thing being deleted —
 * the pattern /gezin already used for removing a child — so the parent can see
 * what they are acting on while they answer.
 */
export function ConfirmDelete({
  question,
  confirmLabel,
  busy = false,
  onConfirm,
  onCancel,
}: {
  question: ReactNode;
  confirmLabel?: ReactNode;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("common");
  return (
    <div
      role="alertdialog"
      aria-label={typeof question === "string" ? question : undefined}
      className="flex flex-wrap items-center gap-3 rounded border border-danger/40 bg-danger/5 px-3 py-2"
    >
      <p className="m-0 flex-1 text-sm text-text">{question}</p>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="danger"
          size="sm"
          disabled={busy}
          onClick={onConfirm}
          autoFocus
        >
          {confirmLabel ?? t("delete")}
        </Button>
        <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={onCancel}>
          {t("cancel")}
        </Button>
      </div>
    </div>
  );
}
