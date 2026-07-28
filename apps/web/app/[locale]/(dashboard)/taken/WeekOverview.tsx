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
import { useRealtimeRefetch } from "../../../../lib/realtime/FamilyRealtimeContext";
import { WEEK_REALTIME_EVENTS } from "../../../../lib/realtime/events";
import { Alert } from "../../../../components/ui";
import WeekPlannerGrid, { WeekPlannerAlert, useWeekMove } from "./WeekPlannerGrid";

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

export default function WeekOverview({ children, tasks, onEditTask }: Props) {
  const t = useTranslations("taken");
  const tw = useTranslations("taken.week");

  const [weekStart, setWeekStart] = useState(() => mondayOfWeek(new Date()));
  const [childFilter, setChildFilter] = useState("");
  const [instances, setInstances] = useState<InstanceView[] | null>(null);
  const [failed, setFailed] = useState(false);

  const range = useMemo(() => weekRange(weekStart), [weekStart]);

  const childMembers = useMemo(
    () => children.filter((m) => m.role === "child"),
    [children],
  );

  const visibleChildren = useMemo(
    () => (childFilter ? childMembers.filter((c) => c.id === childFilter) : childMembers),
    [childFilter, childMembers],
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

  useRealtimeRefetch(WEEK_REALTIME_EVENTS, load);

  const { move, error: moveError, moving } = useWeekMove(setInstances);

  const weekLabel = `${range.from} – ${range.to}`;

  const handleEditTask = useCallback(
    (taskId: string) => {
      if (tasks.some((tsk) => tsk.id === taskId)) onEditTask(taskId);
    },
    [onEditTask, tasks],
  );

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
          {moving && <span className="text-xs text-muted">{tw("moving")}</span>}
        </div>

        <label className="flex items-center gap-2 text-sm text-text">
          <span className="text-muted">{tw("filterChild")}</span>
          <select
            value={childFilter}
            onChange={(e) => setChildFilter(e.target.value)}
            className={fieldClass}
          >
            <option value="">{tw("allChildren")}</option>
            {childMembers.map((child) => (
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

      <WeekPlannerAlert message={moveError} />

      {instances === null && !failed && (
        <p className="mt-4 text-sm text-muted">{t("loading")}</p>
      )}

      {instances !== null && instances.length === 0 && !failed && (
        <p className="mt-4 text-sm text-muted">{tw("empty")}</p>
      )}

      {instances !== null && instances.length > 0 && visibleChildren.length > 0 && !failed && (
        <div className="mt-4">
          <WeekPlannerGrid
            childMembers={visibleChildren}
            days={range.days}
            instances={instances}
            onEditTask={handleEditTask}
            onMove={move}
          />
        </div>
      )}
    </div>
  );
}
