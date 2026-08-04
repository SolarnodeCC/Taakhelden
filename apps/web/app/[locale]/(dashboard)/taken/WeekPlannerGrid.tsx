"use client";

import {
  DndContext,
  type DragEndEvent,
  KeyboardCode,
  type KeyboardCoordinateGetter,
  KeyboardSensor,
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

/**
 * Four visually distinct states, each carrying its meaning on more than one
 * channel (fill, border and glyph) so the grid can be scanned rather than read.
 * Weight tracks urgency: `submitted` is the only state waiting on the parent, so
 * it is the loudest; settled work recedes.
 */
function statusTone(status: InstanceView["status"]): string {
  switch (status) {
    case "approved":
    case "completed":
      return "border border-accent/30 bg-accent/10 text-accent-on-tint";
    case "submitted":
      return "border border-accent bg-accent text-accent-fg";
    case "open_redo":
      return "border border-kid-coral bg-kid-coral-soft text-kid-coral-text";
    default:
      return "border border-border-interactive bg-bg text-text";
  }
}

function statusGlyph(status: InstanceView["status"]): string {
  switch (status) {
    case "approved":
    case "completed":
      return "✓";
    case "submitted":
      return "●";
    case "open_redo":
      return "↻";
    default:
      return "○";
  }
}

/**
 * Keyboard equivalent of the drag gesture (WCAG 2.1.1). dnd-kit's default getter
 * translates by a flat 25px per arrow press, which in a week grid means several
 * presses per cell and no guarantee of landing inside one. This getter is
 * grid-aware instead: it resolves the cell currently under the item, steps one
 * column (day) or one row (child) in the pressed direction, and returns that
 * cell's own position — so one press moves exactly one cell.
 */
function createCellCoordinateGetter(
  childIds: string[],
  days: string[],
): KeyboardCoordinateGetter {
  return (event, { context, currentCoordinates }) => {
    const { droppableRects, over } = context;

    // Prefer the cell dnd-kit reports as hovered; on the first press after lift
    // fall back to whichever cell's rect contains the item's top-left corner.
    let currentId = over?.id != null ? String(over.id) : null;
    if (currentId === null) {
      for (const [id, rect] of droppableRects) {
        if (
          currentCoordinates.x >= rect.left &&
          currentCoordinates.x <= rect.left + rect.width &&
          currentCoordinates.y >= rect.top &&
          currentCoordinates.y <= rect.top + rect.height
        ) {
          currentId = String(id);
          break;
        }
      }
    }

    const cell = currentId === null ? null : parseCellId(currentId);
    if (!cell) return;

    let col = days.indexOf(cell.date);
    let row = childIds.indexOf(cell.childId);
    if (col < 0 || row < 0) return;

    switch (event.code) {
      case KeyboardCode.Right:
        col += 1;
        break;
      case KeyboardCode.Left:
        col -= 1;
        break;
      case KeyboardCode.Down:
        row += 1;
        break;
      case KeyboardCode.Up:
        row -= 1;
        break;
      default:
        return;
    }

    // Stay inside the grid rather than wrapping — wrapping in two dimensions is
    // disorienting when you cannot see the whole table at once.
    const day = days[col];
    const childId = childIds[row];
    if (day === undefined || childId === undefined) return;

    const target = droppableRects.get(cellId(childId, day));
    if (!target) return;

    return { x: target.left, y: target.top };
  };
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
  const t = useTranslations("taken.week");
  const movable = isMovable(inst.status);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: inst.id,
    disabled: !movable,
  });

  const style = transform
    ? { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.5 : 1 }
    : undefined;

  // Edit and move are separate controls on purpose. dnd-kit's keyboard activator
  // claims Enter/Space, so a single button spreading its listeners *and* an
  // onClick would fire both intents from one keypress.
  return (
    <li ref={setNodeRef} style={style}>
      <div
        className={
          "flex min-h-11 items-stretch overflow-hidden rounded text-xs transition-colors " +
          statusTone(inst.status)
        }
      >
        <button
          type="button"
          onClick={() => onEditTask(inst.taskId)}
          className="min-w-0 flex-1 px-2 py-1.5 text-left"
        >
          <span className="block font-medium">
            <span aria-hidden>{statusGlyph(inst.status)} </span>
            {inst.title}
          </span>
          <span className="block text-xs">
            {childLabel} · {statusLabel}
          </span>
        </button>
        {movable && (
          <button
            type="button"
            aria-label={t("moveHandle", { title: inst.title })}
            className="shrink-0 cursor-grab px-2 active:cursor-grabbing"
            {...listeners}
            {...attributes}
          >
            <span aria-hidden>⠿</span>
          </button>
        )}
      </div>
    </li>
  );
}

function DropCell({
  id,
  cellLabel,
  instances,
  childLabel,
  statusFor,
  onEditTask,
}: {
  id: string;
  cellLabel: string;
  instances: InstanceView[];
  childLabel: string;
  statusFor: (status: InstanceView["status"]) => string;
  onEditTask: (taskId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <td
      ref={setNodeRef}
      aria-label={cellLabel}
      className={
        "min-h-16 border-b border-border px-1 py-2 align-top " +
        (isOver ? "bg-accent/10 ring-2 ring-inset ring-accent" : "")
      }
    >
      <ul className="flex min-h-12 flex-col gap-1.5">
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
  const childIds = useMemo(() => childMembers.map((c) => c.id), [childMembers]);
  const coordinateGetter = useMemo(
    () => createCellCoordinateGetter(childIds, days),
    [childIds, days],
  );
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter }),
  );

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

  // dnd-kit ships English announcements by default; this product is NL-first, so
  // the live-region copy has to come from the catalogue like everything else.
  const cellDescription = useCallback(
    (id: string | number | undefined) => {
      const cell = id == null ? null : parseCellId(String(id));
      return cell ? tw("cellLabel", { child: childName(cell.childId), date: cell.date }) : "";
    },
    [childName, tw],
  );

  const announcements = useMemo(
    () => ({
      onDragStart: ({ active }: { active: { id: string | number } }) =>
        tw("a11y.lifted", { cell: cellDescription(active.id) || String(active.id) }),
      onDragOver: ({ over }: { over: { id: string | number } | null }) =>
        over ? tw("a11y.over", { cell: cellDescription(over.id) }) : tw("a11y.outside"),
      onDragEnd: ({ over }: { over: { id: string | number } | null }) =>
        over ? tw("a11y.dropped", { cell: cellDescription(over.id) }) : tw("a11y.cancelled"),
      onDragCancel: () => tw("a11y.cancelled"),
    }),
    [cellDescription, tw],
  );

  return (
    <DndContext
      sensors={sensors}
      accessibility={{
        announcements,
        screenReaderInstructions: { draggable: tw("a11y.instructions") },
      }}
      onDragEnd={(e) => void handleDragEnd(e)}
    >
      <p className="mb-3 text-sm text-muted">{tw("dragHint")}</p>
      {/* The 720px floor is a layout minimum for eight columns, not a token —
          the wrapper scrolls so the page body never scrolls sideways at 320px. */}
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
                    cellLabel={tw("cellLabel", { child: child.displayName, date: day })}
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

  return { move, error, moving };
}
