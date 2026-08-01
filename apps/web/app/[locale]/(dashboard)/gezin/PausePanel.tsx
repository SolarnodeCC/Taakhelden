"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { apiClient, ApiClientError } from "../../../../lib/api/client";
import {
  ChildPause,
  ChildPauseResponse,
  type ChildPause as PauseView,
  type MemberView,
} from "../../../../lib/api/types";
import { Alert, Badge, Button, Field, Input } from "../../../../components/ui";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDateDisplay(isoDate: string | null | undefined): string {
  if (!isoDate) return "";
  const d = new Date(isoDate + "T00:00:00");
  return d.toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" });
}

/** Prefer the active pause; otherwise the first upcoming row. */
function pickPause(list: PauseView[]): PauseView | null {
  return list.find((p) => p.active) ?? list[0] ?? null;
}

interface Props {
  child: MemberView;
  /** Called after a pause is set or cleared so the parent can refresh. */
  onChanged?: () => void;
  /** Called whenever the pause state is known (null = no active pause). */
  onPauseLoaded?: (pause: PauseView | null) => void;
}

type FormState = "idle" | "form" | "busy";

export function ActivePauseBadge({ pause }: { pause: PauseView }) {
  const t = useTranslations("rustschild");
  const label =
    pause.endsOn ? t("badgeActive", { date: formatDateDisplay(pause.endsOn) }) : t("badgeOpenEnded");
  return (
    <Badge tone="accent" aria-label={label}>
      {label}
    </Badge>
  );
}

export default function PausePanel({ child, onChanged, onPauseLoaded }: Props) {
  const t = useTranslations("rustschild");
  const formId = useId();

  const [pause, setPause] = useState<PauseView | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formState, setFormState] = useState<FormState>("idle");
  const [actionError, setActionError] = useState<string | null>(null);

  // Form fields
  const [startsOn, setStartsOn] = useState(todayIso);
  const [endsOn, setEndsOn] = useState("");
  const [reason, setReason] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);

  // Lazy-load the pause state when the panel is first opened.
  const [loaded, setLoaded] = useState(false);
  async function ensureLoaded() {
    if (loaded) return;
    setLoaded(true);
    setLoadError(null);
    try {
      const raw = await apiClient.get(`/api/v1/members/${child.id}/pause`);
      const parsed = ChildPauseResponse.parse(raw);
      const current = pickPause(parsed.pauses);
      setPause(current);
      onPauseLoaded?.(current);
    } catch {
      setLoadError(t("errorLoad"));
      setPause(null);
    }
  }

  async function openForm() {
    await ensureLoaded();
    setStartsOn(todayIso());
    setEndsOn("");
    setReason("");
    setFieldError(null);
    setActionError(null);
    setFormState("form");
  }

  async function save() {
    setFieldError(null);
    setActionError(null);

    if (endsOn && endsOn < startsOn) {
      setFieldError(t("dateRangeInvalid"));
      return;
    }

    setFormState("busy");
    try {
      const raw = await apiClient.put(`/api/v1/members/${child.id}/pause`, {
        startsOn,
        endsOn: endsOn || null,
        reason: reason || undefined,
      });
      // PUT returns a single ChildPause object (not the list envelope).
      const parsed = ChildPause.parse(raw);
      setPause(parsed);
      onPauseLoaded?.(parsed);
      setFormState("idle");
      onChanged?.();
    } catch (err) {
      const msg =
        err instanceof ApiClientError && err.status !== 500
          ? t("errorSave")
          : t("errorSave");
      setActionError(msg);
      setFormState("form");
    }
  }

  async function clearPause() {
    if (!pause) return;
    if (!confirm(t("clearConfirm", { name: child.displayName }))) return;

    setActionError(null);
    setFormState("busy");
    try {
      await apiClient.delete(`/api/v1/members/${child.id}/pause/${pause.id}`);
      setPause(null);
      onPauseLoaded?.(null);
      setFormState("idle");
      onChanged?.();
    } catch {
      setActionError(t("errorClear"));
      setFormState("idle");
    }
  }

  const isBusy = formState === "busy";
  const showForm = formState === "form" || formState === "busy";

  return (
    <div className="mt-3 flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-text">
            {t("title", { name: child.displayName })}
          </p>
          <p className="mt-0.5 text-xs text-muted">{t("hint")}</p>
        </div>
      </div>

      {loadError && <Alert tone="danger">{loadError}</Alert>}
      {actionError && <Alert tone="danger">{actionError}</Alert>}

      {/* Active pause indicator */}
      {pause && (
        <div className="flex items-center justify-between gap-3">
          <ActivePauseBadge pause={pause} />
          {!showForm && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearPause}
              disabled={isBusy}
            >
              {isBusy ? t("clearing") : t("clear")}
            </Button>
          )}
        </div>
      )}

      {/* Set-pause form */}
      {showForm ? (
        <form
          id={formId}
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
          className="flex flex-col gap-3"
          aria-busy={isBusy}
        >
          <Field label={t("fldStartsOn")} error={fieldError ?? undefined}>
            <Input
              type="date"
              value={startsOn}
              min={todayIso()}
              onChange={(e) => setStartsOn(e.target.value)}
              required
              disabled={isBusy}
            />
          </Field>

          <Field label={t("fldEndsOn")}>
            <Input
              type="date"
              value={endsOn}
              min={startsOn}
              onChange={(e) => setEndsOn(e.target.value)}
              disabled={isBusy}
            />
            <span className="mt-0.5 text-xs font-normal text-muted">
              {t("fldEndsOnHint")}
            </span>
          </Field>

          <Field label={t("fldReason")}>
            <Input
              type="text"
              value={reason}
              maxLength={140}
              placeholder={t("fldReasonPlaceholder")}
              onChange={(e) => setReason(e.target.value)}
              disabled={isBusy}
            />
            <span className="mt-0.5 text-xs font-normal text-muted">
              {t("fldReasonHint")}
            </span>
          </Field>

          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" disabled={isBusy}>
              {isBusy ? t("saving") : t("save")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setFormState("idle")}
              disabled={isBusy}
            >
              {t("cancel")}
            </Button>
          </div>
        </form>
      ) : (
        !pause && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={openForm}
          >
            {t("set")}
          </Button>
        )
      )}

      {/* If there's an active pause and form is idle, allow editing */}
      {pause && !showForm && (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={openForm}
        >
          {t("set")}
        </Button>
      )}
    </div>
  );
}
