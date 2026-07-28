"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { apiClient } from "../../../../lib/api/client";
import {
  TaskTemplatesResponse,
  type MemberView,
  type TaskTemplate,
} from "../../../../lib/api/types";
import { ageFromBirthYear } from "../../../../lib/taken/dates";
import { Alert, Button } from "../../../../components/ui";

const fieldClass =
  "mt-1 w-full rounded border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent";

interface Props {
  children: MemberView[];
  onUseTemplate: (template: TaskTemplate, assignees: string[]) => void;
  onCancel: () => void;
}

export default function TemplatePicker({ children, onUseTemplate, onCancel }: Props) {
  const t = useTranslations("taken");
  const tt = useTranslations("taken.templates");

  const defaultChildId = children[0]?.id ?? "";
  const [childId, setChildId] = useState(defaultChildId);
  const [manualAge, setManualAge] = useState(8);
  const [templates, setTemplates] = useState<TaskTemplate[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedChild = children.find((c) => c.id === childId);
  const age =
    selectedChild?.birthYear != null
      ? ageFromBirthYear(selectedChild.birthYear)
      : manualAge;

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const raw = await apiClient.get(`/api/v1/tasks/templates?age=${age}`);
      const parsed = TaskTemplatesResponse.parse(raw);
      setTemplates(parsed.templates);
    } catch {
      setError(tt("loadError"));
      setTemplates(null);
    } finally {
      setLoading(false);
    }
  }, [age, tt]);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  function pickTemplate(template: TaskTemplate) {
    const assignees = childId ? [childId] : [];
    if (assignees.length === 0) return;
    onUseTemplate(template, assignees);
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <h2 className="text-base font-semibold text-text">{tt("title")}</h2>
      <p className="mt-1 text-sm text-muted">{tt("hint")}</p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {children.length > 0 ? (
          <label className="text-sm font-medium text-text">
            {tt("fldChild")}
            <select
              value={childId}
              onChange={(e) => setChildId(e.target.value)}
              className={fieldClass}
            >
              {children.map((child) => (
                <option key={child.id} value={child.id}>
                  {child.displayName}
                  {child.birthYear != null
                    ? ` (${tt("ageYears", { age: ageFromBirthYear(child.birthYear) })})`
                    : ""}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label className="text-sm font-medium text-text">
            {tt("fldAge")}
            <input
              type="number"
              min={4}
              max={18}
              value={manualAge}
              onChange={(e) => setManualAge(Number(e.target.value))}
              className={fieldClass}
            />
          </label>
        )}

        <div className="flex items-end">
          <p className="text-sm text-muted">
            {tt("ageFilter", { age })}
          </p>
        </div>
      </div>

      {error && (
        <div className="mt-3">
          <Alert tone="danger">{error}</Alert>
        </div>
      )}

      {loading && <p className="mt-3 text-sm text-muted">{t("loading")}</p>}

      {!loading && templates !== null && templates.length === 0 && (
        <p className="mt-3 text-sm text-muted">{tt("empty")}</p>
      )}

      {!loading && templates !== null && templates.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {templates.map((template) => (
            <li
              key={template.title}
              className="flex items-center justify-between gap-3 rounded border border-border bg-bg px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-text">{template.title}</p>
                <p className="text-xs text-muted">
                  {template.category != null ? t(`category.${template.category}`) : "—"}
                  {template.points != null ? ` · ${t("points", { points: template.points })}` : ""}
                  {template.recurrence != null
                    ? ` · ${
                        template.recurrence.freq === "daily"
                          ? t("recurrence.daily")
                          : t("recurrence.weekly")
                      }`
                    : ""}
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                disabled={children.length === 0}
                onClick={() => pickTemplate(template)}
              >
                {tt("use")}
              </Button>
            </li>
          ))}
        </ul>
      )}

      {children.length === 0 && (
        <p className="mt-3 text-sm text-muted">{tt("noChildren")}</p>
      )}

      <div className="mt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>
          {tt("cancel")}
        </Button>
      </div>
    </div>
  );
}
