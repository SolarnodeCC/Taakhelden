"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  type TaskView,
  type TaskFormPayload,
  type TaskFormPrefill,
  type TaskCategory,
  type Daypart,
  type Weekday,
} from "../../../../lib/api/types";
import type { MemberView } from "../../../../lib/api/types";
import { isDateRangeValid } from "../../../../lib/taken/dates";
import { Button, Alert } from "../../../../components/ui";

const CATEGORIES: TaskCategory[] = ["household", "homework", "selfcare", "custom"];
const DAYPARTS: Daypart[] = ["morning", "afternoon", "evening"];
const WEEKDAYS: Weekday[] = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];
type RecurrenceChoice = "once" | "daily" | "weekly";

const fieldClass =
  "mt-1 w-full rounded border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent";

function mergeSource(initial?: TaskView, prefill?: TaskFormPrefill) {
  return { ...prefill, ...initial };
}

interface Props {
  children: MemberView[];
  initial?: TaskView;
  prefill?: TaskFormPrefill;
  onSubmit: (payload: TaskFormPayload) => Promise<void>;
  onCancel: () => void;
}

export default function TaskForm({ children, initial, prefill, onSubmit, onCancel }: Props) {
  const t = useTranslations("taken");
  const tf = useTranslations("taken.form");
  const src = mergeSource(initial, prefill);

  const [title, setTitle] = useState(src.title ?? "");
  const [category, setCategory] = useState<TaskCategory>(src.category ?? "household");
  const [icon, setIcon] = useState(src.icon ?? "star");
  const [points, setPoints] = useState(src.points ?? 10);
  const [photoBonus, setPhotoBonus] = useState(src.photoBonusPoints ?? 0);
  const [approval, setApproval] = useState(src.approvalRequired ?? false);
  const [assignees, setAssignees] = useState<string[]>(src.assignees ?? []);
  const [rotationEnabled, setRotationEnabled] = useState((src.rotation?.length ?? 0) >= 2);
  const [rotationOrder, setRotationOrder] = useState<string[]>(src.rotation ?? []);
  const [activeFrom, setActiveFrom] = useState(src.activeFrom ?? "");
  const [activeUntil, setActiveUntil] = useState(src.activeUntil ?? "");
  const [daypart, setDaypart] = useState<Daypart | "">(src.daypart ?? "");
  const [recChoice, setRecChoice] = useState<RecurrenceChoice>(
    src.recurrence == null ? "once" : src.recurrence.freq,
  );
  const [days, setDays] = useState<Weekday[]>(src.recurrence?.days ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle<T>(list: T[], value: T): T[] {
    return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
  }

  function moveRotation(id: string, dir: -1 | 1) {
    setRotationOrder((prev) => {
      const idx = prev.indexOf(id);
      if (idx < 0) return prev;
      const next = idx + dir;
      if (next < 0 || next >= prev.length) return prev;
      const copy = [...prev];
      const tmp = copy[idx]!;
      copy[idx] = copy[next]!;
      copy[next] = tmp;
      setAssignees(copy);
      return copy;
    });
  }

  function toggleRotationChild(id: string) {
    setRotationOrder((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      if (next.length >= 2) setAssignees(next);
      return next;
    });
  }

  function enableRotation(checked: boolean) {
    setRotationEnabled(checked);
    if (checked) {
      const seedOrder = assignees.length >= 2 ? assignees : [];
      setRotationOrder(seedOrder);
      if (seedOrder.length >= 2) setAssignees(seedOrder);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (assignees.length === 0) {
      setError(tf("assigneesRequired"));
      return;
    }
    if (rotationEnabled && rotationOrder.length < 2) {
      setError(tf("rotationRequired"));
      return;
    }
    if (activeFrom && activeUntil && !isDateRangeValid(activeFrom, activeUntil)) {
      setError(tf("dateRangeInvalid"));
      return;
    }
    const recurrence =
      recChoice === "once"
        ? null
        : recChoice === "daily"
          ? { freq: "daily" as const }
          : { freq: "weekly" as const, days };

    setBusy(true);
    try {
      await onSubmit({
        title: title.trim(),
        category,
        icon: icon.trim() || "star",
        points,
        photoBonusPoints: photoBonus,
        approvalRequired: approval,
        assignees: rotationEnabled && rotationOrder.length >= 2 ? rotationOrder : assignees,
        rotation:
          rotationEnabled && rotationOrder.length >= 2 ? rotationOrder : undefined,
        recurrence,
        daypart: daypart === "" ? null : daypart,
        activeFrom: activeFrom || undefined,
        activeUntil: activeUntil || null,
      });
    } catch {
      setError(tf("errorSave"));
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-border bg-surface p-4"
    >
      <h2 className="text-base font-semibold text-text">
        {initial ? tf("editTitle") : tf("createTitle")}
      </h2>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium text-text sm:col-span-2">
          {tf("fldTitle")}
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={80}
            className={fieldClass}
          />
        </label>

        <label className="text-sm font-medium text-text">
          {tf("fldCategory")}
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as TaskCategory)}
            className={fieldClass}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(`category.${c}`)}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-medium text-text">
          {tf("fldIcon")}
          <input value={icon} onChange={(e) => setIcon(e.target.value)} className={fieldClass} />
        </label>

        <label className="text-sm font-medium text-text">
          {tf("fldPoints")}
          <input
            type="number"
            min={1}
            max={500}
            value={points}
            onChange={(e) => setPoints(Number(e.target.value))}
            required
            className={fieldClass}
          />
        </label>

        <label className="text-sm font-medium text-text">
          {tf("fldPhotoBonus")}
          <input
            type="number"
            min={0}
            max={100}
            value={photoBonus}
            onChange={(e) => setPhotoBonus(Number(e.target.value))}
            className={fieldClass}
          />
        </label>

        <label className="text-sm font-medium text-text">
          {tf("fldDaypart")}
          <select
            value={daypart}
            onChange={(e) => setDaypart(e.target.value as Daypart | "")}
            className={fieldClass}
          >
            <option value="">{t("daypart.any")}</option>
            {DAYPARTS.map((d) => (
              <option key={d} value={d}>
                {t(`daypart.${d}`)}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-medium text-text">
          {tf("fldRecurrence")}
          <select
            value={recChoice}
            onChange={(e) => setRecChoice(e.target.value as RecurrenceChoice)}
            className={fieldClass}
          >
            <option value="once">{t("recurrence.once")}</option>
            <option value="daily">{t("recurrence.daily")}</option>
            <option value="weekly">{t("recurrence.weekly")}</option>
          </select>
        </label>

        <label className="text-sm font-medium text-text">
          {tf("fldActiveFrom")}
          <input
            type="date"
            value={activeFrom}
            onChange={(e) => setActiveFrom(e.target.value)}
            className={fieldClass}
          />
        </label>

        <label className="text-sm font-medium text-text">
          {tf("fldActiveUntil")}
          <input
            type="date"
            value={activeUntil}
            onChange={(e) => setActiveUntil(e.target.value)}
            className={fieldClass}
          />
        </label>
      </div>

      {recChoice === "weekly" && (
        <fieldset className="mt-3">
          <legend className="text-sm font-medium text-text">{tf("fldDays")}</legend>
          <div className="mt-1 flex flex-wrap gap-2">
            {WEEKDAYS.map((d) => (
              <label
                key={d}
                className={
                  "cursor-pointer rounded border px-2.5 py-1 text-sm " +
                  (days.includes(d)
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border text-muted")
                }
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={days.includes(d)}
                  onChange={() => setDays((prev) => toggle(prev, d))}
                />
                {t(`weekday.${d}`)}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {children.length >= 2 && (
        <fieldset className="mt-3">
          <label className="flex items-center gap-2 text-sm font-medium text-text">
            <input
              type="checkbox"
              checked={rotationEnabled}
              onChange={(e) => enableRotation(e.target.checked)}
            />
            {tf("fldRotation")}
          </label>
          <p className="mt-1 text-xs text-muted">{tf("rotationHint")}</p>
          {rotationEnabled && (
            <ul className="mt-2 flex flex-col gap-1">
              {rotationOrder.map((id, idx) => {
                const child = children.find((c) => c.id === id);
                if (!child) return null;
                return (
                  <li
                    key={id}
                    className="flex items-center justify-between gap-2 rounded border border-border bg-bg px-2 py-1 text-sm"
                  >
                    <span>
                      {idx + 1}. {child.displayName}
                    </span>
                    <span className="flex gap-1">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => moveRotation(id, -1)}
                        className="rounded border border-border px-1.5 text-xs disabled:opacity-40"
                        aria-label={tf("moveUp")}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        disabled={idx === rotationOrder.length - 1}
                        onClick={() => moveRotation(id, 1)}
                        className="rounded border border-border px-1.5 text-xs disabled:opacity-40"
                        aria-label={tf("moveDown")}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleRotationChild(id)}
                        className="rounded border border-border px-1.5 text-xs"
                        aria-label={tf("removeFromRotation")}
                      >
                        ×
                      </button>
                    </span>
                  </li>
                );
              })}
              <div className="mt-1 flex flex-wrap gap-2">
                {children
                  .filter((c) => !rotationOrder.includes(c.id))
                  .map((child) => (
                    <button
                      key={child.id}
                      type="button"
                      onClick={() => toggleRotationChild(child.id)}
                      className="rounded border border-border px-2 py-0.5 text-xs text-muted hover:bg-bg"
                    >
                      + {child.displayName}
                    </button>
                  ))}
              </div>
            </ul>
          )}
        </fieldset>
      )}

      {!rotationEnabled && (
        <fieldset className="mt-3">
          <legend className="text-sm font-medium text-text">{tf("fldAssignees")}</legend>
          <div className="mt-1 flex flex-wrap gap-2">
            {children.map((child) => (
              <label
                key={child.id}
                className={
                  "cursor-pointer rounded border px-2.5 py-1 text-sm " +
                  (assignees.includes(child.id)
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border text-muted")
                }
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={assignees.includes(child.id)}
                  onChange={() => setAssignees((prev) => toggle(prev, child.id))}
                />
                {child.displayName}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <label className="mt-3 flex items-center gap-2 text-sm font-medium text-text">
        <input type="checkbox" checked={approval} onChange={(e) => setApproval(e.target.checked)} />
        {tf("fldApproval")}
      </label>

      {error && (
        <div className="mt-3">
          <Alert tone="danger">{error}</Alert>
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <Button type="submit" disabled={busy}>
          {busy ? tf("saving") : tf("save")}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={busy}>
          {tf("cancel")}
        </Button>
      </div>
    </form>
  );
}
