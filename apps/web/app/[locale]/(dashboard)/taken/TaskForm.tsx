"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  type TaskView,
  type TaskFormPayload,
  type TaskCategory,
  type Daypart,
  type Weekday,
} from "../../../../lib/api/types";
import type { MemberView } from "../../../../lib/api/types";
import { Button, Alert } from "../../../../components/ui";

const CATEGORIES: TaskCategory[] = ["household", "homework", "selfcare", "custom"];
const DAYPARTS: Daypart[] = ["morning", "afternoon", "evening"];
const WEEKDAYS: Weekday[] = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];
type RecurrenceChoice = "once" | "daily" | "weekly";

const fieldClass =
  "mt-1 w-full rounded border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent";

interface Props {
  children: MemberView[];
  initial?: TaskView;
  onSubmit: (payload: TaskFormPayload) => Promise<void>;
  onCancel: () => void;
}

export default function TaskForm({ children, initial, onSubmit, onCancel }: Props) {
  const t = useTranslations("taken");
  const tf = useTranslations("taken.form");

  const [title, setTitle] = useState(initial?.title ?? "");
  const [category, setCategory] = useState<TaskCategory>(initial?.category ?? "household");
  const [icon, setIcon] = useState(initial?.icon ?? "star");
  const [points, setPoints] = useState(initial?.points ?? 10);
  const [photoBonus, setPhotoBonus] = useState(initial?.photoBonusPoints ?? 0);
  const [approval, setApproval] = useState(initial?.approvalRequired ?? false);
  const [assignees, setAssignees] = useState<string[]>(initial?.assignees ?? []);
  const [daypart, setDaypart] = useState<Daypart | "">(initial?.daypart ?? "");
  const [recChoice, setRecChoice] = useState<RecurrenceChoice>(
    initial?.recurrence == null ? "once" : initial.recurrence.freq,
  );
  const [days, setDays] = useState<Weekday[]>(initial?.recurrence?.days ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle<T>(list: T[], value: T): T[] {
    return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (assignees.length === 0) {
      setError(tf("assigneesRequired"));
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
        assignees,
        recurrence,
        daypart: daypart === "" ? null : daypart,
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

      <label className="mt-3 flex items-center gap-2 text-sm font-medium text-text">
        <input type="checkbox" checked={approval} onChange={(e) => setApproval(e.target.checked)} />
        {tf("fldApproval")}
      </label>

      {error && <div className="mt-3"><Alert tone="danger">{error}</Alert></div>}

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
