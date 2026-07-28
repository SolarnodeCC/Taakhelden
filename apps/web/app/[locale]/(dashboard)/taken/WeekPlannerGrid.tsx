"use client";

import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useCallback, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useTranslations } from "next-intl";
import { InstanceView, type MemberView } from "../../../../lib/api/types";
import { apiClient, ApiClientError } from "../../../../lib/api/client";
import { Alert } from "../../../../components/ui";

function cellId(childId: string, date: string) {
  return `${childId}|${date}`;
}

function parseCellId(id: string): { childId: string; date: string } | null {
  const sep = id.indexOf("|");
  if (sep < 0) return null;
  return { childId: id.slice(0, sep), date: id.slice(sep + 1) };
}

function isMovable(status: InstanceView["status"]) {
  return status === "open" || status === "open_redo";
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

function InstanceChip({
  inst,
  childLabel,
  statusLabel,
  onEditTask,
}: {
  inst: InstanceView;
  childLabel: string;
  statusLabel: string;
  onEditTask: (taskId: string) => void;
}) {
  const movable = isMovable(inst.status);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: inst.id,
    disabled: !movable,
  });

  const style = transform
    ? { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.5 : 1 }
    : undefined;

  return (
    <li ref={setNodeRef} style={style}>
      <button
        type="button"
        onClick={() => onEditTask(inst.taskId)}
        className={
          "w-full rounded px-2 py-1.5 text-left text-xs transition-colors " +
          statusTone(inst.status) +
          (movable ? " cursor-grab active:cursor-grabbing" : " cursor-pointer hover:bg-bg")
        }
        {...(movable ? { ...listeners, ...attributes } : {})}
      >
        <span className="block font-medium">{inst.title}</span>
        <span className="block text-[11px] opacity-80">
          {childLabel} · {statusLabel}
        </span>
      </button>
    </li>
  );
}

function DropCell({
  id,
  instances,
  childLabel,
  statusFor,
  onEditTask,
}: {
  id: string;
  instances: InstanceView[];
  childLabel: string;
  statusFor: (status: InstanceView["status"]) => string;
  onEditTask: (taskId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <td
      ref={setNodeRef}
      className={
        "align-top border-b border-border px-1 py-2 min-h-[4rem] " +
        (isOver ? "bg-accent/5 ring-1 ring-inset ring-accent/30" : "")
      }
    >
      <ul className="flex min-h-[3rem] flex-col gap-1.5">
        {instances.map((inst) => (
          <InstanceChip
            key={inst.id}
            inst={inst}
            childLabel={childLabel}
            statusLabel={statusFor(inst.status)}
            onEditTask={onEditTask}
          />
        ))}
      </ul>
    </td>
  );
}

interface Props {
  childMembers: MemberView[];
  days: string[];
  instances: InstanceView[];
  onEditTask: (taskId: string) => void;
  onMove: (instanceId: string, target: { date: string; childId: string }) => Promise<void>;
}

export default function WeekPlannerGrid({
  childMembers,
  days,
  instances,
  onEditTask,
  onMove,
}: Props) {
  const tw = useTranslations("taken.week");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const childName = useCallback(
    (id: string) => childMembers.find((c) => c.id === id)?.displayName ?? "—",
    [childMembers],
  );

  const byChildDate = useMemo(() => {
    const map = new Map<string, InstanceView[]>();
    for (const child of childMembers) {
      for (const day of days) {
        map.set(cellId(child.id, day), []);
      }
    }
    for (const inst of instances) {
      const key = cellId(inst.childId, inst.date);
      const list = map.get(key);
      if (list) list.push(inst);
    }
    return map;
  }, [childMembers, days, instances]);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over) return;
      const target = parseCellId(String(over.id));
      if (!target) return;
      const inst = instances.find((i) => i.id === active.id);
      if (!inst || !isMovable(inst.status)) return;
      if (inst.date === target.date && inst.childId === target.childId) return;
      await onMove(String(active.id), target);
    },
    [instances, onMove],
  );

  return (
    <DndContext sensors={sensors} onDragEnd={(e) => void handleDragEnd(e)}>
      <p className="mb-3 text-sm text-muted">{tw("dragHint")}</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead>
            <tr>
              <th className="border-b border-border px-2 py-2 font-medium text-muted w-24" />
              {days.map((day) => {
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
            {childMembers.map((child) => (
              <tr key={child.id}>
                <th
                  scope="row"
                  className="border-b border-border px-2 py-2 text-left font-medium text-text"
                >
                  {child.displayName}
                </th>
                {days.map((day) => (
                  <DropCell
                    key={cellId(child.id, day)}
                    id={cellId(child.id, day)}
                    instances={byChildDate.get(cellId(child.id, day)) ?? []}
                    childLabel={childName(child.id)}
                    statusFor={(status) => tw(`status.${status}`)}
                    onEditTask={onEditTask}
                  />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DndContext>
  );
}

export function WeekPlannerAlert({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="mt-3">
      <Alert tone="danger">{message}</Alert>
    </div>
  );
}

export function useWeekMove(setInstances: Dispatch<SetStateAction<InstanceView[] | null>>) {
  const tw = useTranslations("taken.week");
  const [error, setError] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);
  const pendingRef = useRef(false);

  const move = useCallback(
    async (instanceId: string, target: { date: string; childId: string }) => {
      setError(null);
      pendingRef.current = true;
      setMoving(true);

      let previous: InstanceView[] | null = null;
      setInstances((current) => {
        previous = current;
        if (!current) return current;
        return current.map((inst) =>
          inst.id === instanceId ? { ...inst, date: target.date, childId: target.childId } : inst,
        );
      });

      try {
        const updated = await apiClient.post<InstanceView>(`/api/v1/instances/${instanceId}/move`, target);
        setInstances((current) =>
          current?.map((inst) => (inst.id === instanceId ? updated : inst)) ?? current,
        );
      } catch (err) {
        setInstances(previous);
        if (err instanceof ApiClientError) {
          if (err.code === "INSTANCE_SLOT_TAKEN") setError(tw("slotTaken"));
          else if (err.code === "INVALID_STATUS") setError(tw("notMovable"));
          else setError(tw("moveError"));
        } else {
          setError(tw("moveError"));
        }
      } finally {
        pendingRef.current = false;
        setMoving(false);
      }
    },
    [setInstances, tw],
  );

  return { move, error, moving, isPending: () => pendingRef.current };
}
