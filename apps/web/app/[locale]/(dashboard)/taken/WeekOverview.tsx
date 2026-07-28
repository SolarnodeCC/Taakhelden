"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { apiClient } from "../../../../lib/api/client";
import {
  InstanceHistoryResponse,
  type InstanceView,
  type MemberView,
  type TaskView,
} from "../../../../lib/api/types";
import { addDays, mondayOfWeek, weekRange } from "../../../../lib/taken/dates";
import { Alert } from "../../../../components/ui";

const fieldClass =
  "rounded border border-border bg-bg px-2 py-1.5 text-sm outline-none focus:border-accent";

interface Props {
  children: MemberView[];
  tasks: TaskView[];
  onEditTask: (taskId: string) => void;
}

async function fetchWeekInstances(
  from: string,
  to: string,
  childId?: string,
): Promise<InstanceView[]> {
  const all: InstanceView[] = [];
  let cursor: string | null = null;
  for (;;) {
    const params = new URLSearchParams({ from, to, limit: "100" });
    if (childId) params.set("childId", childId);
    if (cursor) params.set("cursor", cursor);
    const raw = await apiClient.get(`/api/v1/instances?${params.toString()}`);
    const parsed = InstanceHistoryResponse.parse(raw);
    all.push(...parsed.instances);
    if (!parsed.nextCursor) break;
    cursor = parsed.nextCursor;
  }
  return all;
}

function statusTone(status: InstanceView["status"]): string {
  switch (status) {
    case "approved":
    case "completed":
      return "bg-accent/10 text-accent";
    case "submitted":
      return "bg-accent/15 text-accent";
    case "open_redo":
      return "border border-border text-muted";
    default:
      return "border border-border text-text";
  }
}

export default function WeekOverview({ children, tasks, onEditTask }: Props) {
  const t = useTranslations("taken");
  const tw = useTranslations("taken.week");

  const [weekStart, setWeekStart] = useState(() => mondayOfWeek(new Date()));
  const [childFilter, setChildFilter] = useState("");
  const [instances, setInstances] = useState<InstanceView[] | null>(null);
  const [failed, setFailed] = useState(false);

  const range = useMemo(() => weekRange(weekStart), [weekStart]);

  const childName = useCallback(
    (id: string) => children.find((c) => c.id === id)?.displayName ?? "—",
    [children],
  );

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const rows = await fetchWeekInstances(
        range.from,
        range.to,
        childFilter || undefined,
      );
      setInstances(rows);
    } catch {
      setFailed(true);
      setInstances(null);
    }
  }, [range.from, range.to, childFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const byDate = useMemo(() => {
    const map = new Map<string, InstanceView[]>();
    for (const day of range.days) {
      map.set(day, []);
    }
    for (const inst of instances ?? []) {
      const list = map.get(inst.date);
      if (list) list.push(inst);
    }
    return map;
  }, [instances, range.days]);

  const weekLabel = `${range.from} – ${range.to}`;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setWeekStart((d) => addDays(d, -7))}
            className="rounded border border-border px-2 py-1 text-sm text-text hover:bg-bg"
            aria-label={tw("prevWeek")}
          >
            ←
          </button>
          <button
            type="button"
            onClick={() => setWeekStart(mondayOfWeek(new Date()))}
            className="rounded border border-border px-2 py-1 text-sm text-text hover:bg-bg"
          >
            {tw("thisWeek")}
          </button>
          <button
            type="button"
            onClick={() => setWeekStart((d) => addDays(d, 7))}
            className="rounded border border-border px-2 py-1 text-sm text-text hover:bg-bg"
            aria-label={tw("nextWeek")}
          >
            →
          </button>
          <span className="text-sm font-medium text-text">{weekLabel}</span>
        </div>

        <label className="flex items-center gap-2 text-sm text-text">
          <span className="text-muted">{tw("filterChild")}</span>
          <select
            value={childFilter}
            onChange={(e) => setChildFilter(e.target.value)}
            className={fieldClass}
          >
            <option value="">{tw("allChildren")}</option>
            {children.map((child) => (
              <option key={child.id} value={child.id}>
                {child.displayName}
              </option>
            ))}
          </select>
        </label>
      </div>

      {failed && (
        <div className="mt-3">
          <Alert tone="danger">{tw("loadError")}</Alert>
        </div>
      )}

      {instances === null && !failed && (
        <p className="mt-4 text-sm text-muted">{t("loading")}</p>
      )}

      {instances !== null && instances.length === 0 && !failed && (
        <p className="mt-4 text-sm text-muted">{tw("empty")}</p>
      )}

      {instances !== null && instances.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr>
                {range.days.map((day) => {
                  const d = new Date(`${day}T12:00:00`);
                  const weekday = d.toLocaleDateString(undefined, { weekday: "short" });
                  return (
                    <th
                      key={day}
                      className="border-b border-border px-2 py-2 font-medium text-muted"
                    >
                      <div>{weekday}</div>
                      <div className="text-xs font-normal">{day.slice(5)}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              <tr>
                {range.days.map((day) => (
                  <td
                    key={day}
                    className="align-top border-b border-border px-1 py-2"
                  >
                    <ul className="flex flex-col gap-1.5">
                      {(byDate.get(day) ?? []).map((inst) => {
                        const taskExists = tasks.some((tsk) => tsk.id === inst.taskId);
                        return (
                          <li key={inst.id}>
                            <button
                              type="button"
                              disabled={!taskExists}
                              onClick={() => onEditTask(inst.taskId)}
                              className={
                                "w-full rounded px-2 py-1.5 text-left text-xs transition-colors " +
                                (taskExists
                                  ? "cursor-pointer hover:bg-bg"
                                  : "cursor-default opacity-60") +
                                " " +
                                statusTone(inst.status)
                              }
                            >
                              <span className="block font-medium">{inst.title}</span>
                              <span className="block text-[11px] opacity-80">
                                {childName(inst.childId)} · {tw(`status.${inst.status}`)}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
