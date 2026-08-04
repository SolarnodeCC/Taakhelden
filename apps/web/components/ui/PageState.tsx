"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Alert } from "./Alert";
import { Button } from "./Button";

/**
 * A failed page load, presented as something the parent can act on.
 *
 * Two things this fixes over a bare `<p className="text-danger">`: the Alert
 * carries `role="alert"`, so a failure that happens *after* first render is
 * actually announced; and the retry button gives a way out that isn't "guess
 * that you should reload". Every screen already owns a `load` callback — pass
 * it here rather than leaving the user at a dead end.
 */
export function PageError({
  message,
  onRetry,
}: {
  message: ReactNode;
  onRetry?: () => void;
}) {
  const t = useTranslations("common");
  return (
    <Alert tone="danger">
      <span className="flex flex-wrap items-center gap-3">
        <span>{message}</span>
        {onRetry && (
          <Button type="button" size="sm" variant="secondary" onClick={onRetry}>
            {t("retry")}
          </Button>
        )}
      </span>
    </Alert>
  );
}

/**
 * An empty state that points somewhere. These are the first screens a new family
 * sees, so a lone grey sentence is a wasted moment — give the state a name, a
 * line of explanation, and the action that resolves it.
 */
export function EmptyState({
  title,
  body,
  action,
}: {
  title: ReactNode;
  body?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-border-interactive bg-surface px-4 py-8 text-center">
      <p className="text-base font-semibold text-text">{title}</p>
      {body && <p className="mx-auto mt-1 max-w-sm text-sm text-muted">{body}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
