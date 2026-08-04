"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { apiClient, ApiClientError } from "../../../../lib/api/client";
import {
  MemberList,
  TaskList,
  type MemberView,
  type TaskView,
  type TaskFormPayload,
  type TaskFormPrefill,
  type TaskTemplate,
} from "../../../../lib/api/types";
import { displayIcon } from "../../../../lib/icons";
import { useRouter } from "../../../../i18n/navigation";
import {
  FullParentForbidden,
  FullParentUpstreamError,
  useRequireFullParent,
} from "../../../../lib/auth/RequireFullParent";
import { Button, Card, ConfirmDelete, EmptyState, PageError, SkeletonRows } from "../../../../components/ui";
import TaskForm from "./TaskForm";
import TemplatePicker from "./TemplatePicker";
import WeekOverview from "./WeekOverview";

type Tab = "list" | "week";
type FormState =
  | { mode: "create"; prefill?: TaskFormPrefill }
  | { mode: "edit"; task: TaskView }
  | null;

function TaskRow({
  task,
  childName,
  onEdit,
  onDelete,
  confirming,
  onConfirmDelete,
  onCancelDelete,
}: {
  task: TaskView;
  childName: (id: string) => string;
  onEdit: () => void;
  onDelete: () => void;
  confirming: boolean;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
}) {
  const t = useTranslations("taken");
  const recurrence =
    task.recurrence == null
      ? t("recurrence.once")
      : task.recurrence.freq === "daily"
        ? t("recurrence.daily")
        : `${t("recurrence.weekly")} · ${(task.recurrence.days ?? [])
            .map((d) => t(`weekday.${d}`))
            .join(", ")}`;

  const hasRotation = (task.rotation?.length ?? 0) >= 2;
  const assigneeLabel = hasRotation
    ? t("badge.rotation", {
        names: (task.rotation ?? []).map((id) => childName(id)).join(" → "),
      })
    : null;

  return (
    <Card as="li" variant="row" className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {displayIcon(task.icon) && <span aria-hidden>{displayIcon(task.icon)}</span>}
          <h2 className="truncate text-lg font-semibold text-text">{task.title}</h2>
        </div>
        <p className="mt-0.5 text-sm text-muted">
          {t("points", { points: task.points })} · {t(`category.${task.category}`)} · {recurrence}
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {hasRotation ? (
            <span className="rounded-full bg-bg px-2 py-0.5 text-xs text-muted">
              {assigneeLabel}
            </span>
          ) : (
            task.assignees.map((id) => (
              <span key={id} className="rounded-full bg-bg px-2 py-0.5 text-xs text-muted">
                {childName(id)}
              </span>
            ))
          )}
          {task.daypart && (
            <span className="rounded-full bg-bg px-2 py-0.5 text-xs text-muted">
              {t(`daypart.${task.daypart}`)}
            </span>
          )}
          {(task.activeFrom || task.activeUntil) && (
            <span className="rounded-full bg-bg px-2 py-0.5 text-xs text-muted">
              {task.activeFrom && task.activeUntil
                ? t("badge.dateRange", { from: task.activeFrom, until: task.activeUntil })
                : task.activeFrom
                  ? t("badge.fromDate", { from: task.activeFrom })
                  : t("badge.untilDate", { until: task.activeUntil! })}
            </span>
          )}
          {task.approvalRequired && (
            <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent-on-tint">
              {t("badge.approval")}
            </span>
          )}
          {task.photoBonusPoints > 0 && (
            <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent-on-tint">
              {t("badge.photoBonus", { points: task.photoBonusPoints })}
            </span>
          )}
        </div>
      </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex min-h-11 items-center rounded border border-border-interactive px-3 py-1.5 text-sm font-medium text-text transition-colors hover:bg-bg"
          >
            {t("edit")}
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex min-h-11 items-center rounded border border-border-interactive px-3 py-1.5 text-sm font-medium text-danger transition-colors hover:bg-bg"
          >
            {t("delete")}
          </button>
        </div>
      </div>
      {confirming && (
        <ConfirmDelete
          question={t("deleteConfirm")}
          onConfirm={onConfirmDelete}
          onCancel={onCancelDelete}
        />
      )}
    </Card>
  );
}

function templateToPrefill(template: TaskTemplate, assignees: string[]): TaskFormPrefill {
  return {
    title: template.title,
    category: template.category,
    icon: template.icon,
    points: template.points,
    photoBonusPoints: template.photoBonusPoints,
    approvalRequired: template.approvalRequired,
    recurrence: template.recurrence ?? null,
    daypart: template.daypart ?? null,
    assignees,
  };
}

export default function TakenClient() {
  const t = useTranslations("taken");
  const router = useRouter();
  const gate = useRequireFullParent();
  const [tab, setTab] = useState<Tab>("list");
  const [tasks, setTasks] = useState<TaskView[] | null>(null);
  const [children, setChildren] = useState<MemberView[]>([]);
  const [failed, setFailed] = useState(false);
  const [form, setForm] = useState<FormState>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<TaskView | null>(null);

  const load = useCallback(async () => {
    try {
      const [tasksRaw, membersRaw] = await Promise.all([
        apiClient.get("/api/v1/tasks"),
        apiClient.get("/api/v1/members"),
      ]);
      setTasks(TaskList.parse(tasksRaw));
      setChildren(MemberList.parse(membersRaw).filter((m) => m.role === "child"));
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 401) {
        router.push("/login");
        return;
      }
      setFailed(true);
    }
  }, [router]);

  useEffect(() => {
    if (gate !== "ok") return;
    void load();
  }, [gate, load]);

  const childName = useCallback(
    (id: string) => children.find((c) => c.id === id)?.displayName ?? "—",
    [children],
  );

  if (gate === "forbidden") return <FullParentForbidden />;
  if (gate === "upstream_error") return <FullParentUpstreamError />;
  if (gate === "loading") return <p className="text-sm text-muted">{t("loading")}</p>;

  async function submit(payload: TaskFormPayload) {
    if (form?.mode === "edit") {
      await apiClient.patch(`/api/v1/tasks/${form.task.id}`, payload);
    } else {
      await apiClient.post("/api/v1/tasks", payload);
    }
    setForm(null);
    setShowTemplates(false);
    await load();
  }

  async function remove(task: TaskView) {
    try {
      await apiClient.delete(`/api/v1/tasks/${task.id}`);
      setTasks((prev) => (prev ? prev.filter((x) => x.id !== task.id) : prev));
      setPendingDelete(null);
    } catch {
      setFailed(true);
    }
  }

  function openEdit(taskId: string) {
    const task = tasks?.find((tsk) => tsk.id === taskId);
    if (!task) return;
    setTab("list");
    setShowTemplates(false);
    setForm({ mode: "edit", task });
  }

  function useTemplate(template: TaskTemplate, assignees: string[]) {
    setShowTemplates(false);
    setTab("list");
    setForm({ mode: "create", prefill: templateToPrefill(template, assignees) });
  }

  const tabClass = (active: boolean) =>
    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors " +
    (active ? "bg-accent/10 text-accent-on-tint" : "text-muted hover:bg-bg hover:text-text");

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-text">{t("title")}</h1>
        {form === null && !showTemplates && (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => setShowTemplates(true)}>
              {t("fromTemplate")}
            </Button>
            <Button type="button" onClick={() => setForm({ mode: "create" })}>
              {t("newTask")}
            </Button>
          </div>
        )}
      </div>

      <div className="mt-4 flex gap-2 border-b border-border pb-2">
        <button type="button" className={tabClass(tab === "list")} onClick={() => setTab("list")}>
          {t("tab.list")}
        </button>
        <button type="button" className={tabClass(tab === "week")} onClick={() => setTab("week")}>
          {t("tab.week")}
        </button>
      </div>

      {failed && (
        <div className="mt-4">
          <PageError message={t("loadError")} onRetry={() => void load()} />
        </div>
      )}

      {showTemplates && (
        <div className="mt-4">
          <TemplatePicker
            children={children}
            onUseTemplate={useTemplate}
            onCancel={() => setShowTemplates(false)}
          />
        </div>
      )}

      {form !== null && (
        <div className="mt-4">
          <TaskForm
            children={children}
            initial={form.mode === "edit" ? form.task : undefined}
            prefill={form.mode === "create" ? form.prefill : undefined}
            onSubmit={submit}
            onCancel={() => setForm(null)}
          />
        </div>
      )}

      {tab === "list" && !failed && tasks === null && (
        <div className="mt-4" aria-busy>
          <SkeletonRows count={3} />
        </div>
      )}

      {tab === "list" && tasks !== null && tasks.length === 0 && form === null && !showTemplates && (
        <div className="mt-4">
          <EmptyState
            title={t("emptyTitle")}
            body={t("emptyBody")}
            action={
              <Button type="button" onClick={() => setForm({ mode: "create" })}>
                {t("newTask")}
              </Button>
            }
          />
        </div>
      )}

      {tab === "list" && tasks !== null && tasks.length > 0 && (
        <ul className="mt-4 flex flex-col gap-3">
          {tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              childName={childName}
              onEdit={() => setForm({ mode: "edit", task })}
              onDelete={() => setPendingDelete(task)}
              confirming={pendingDelete?.id === task.id}
              onConfirmDelete={() => void remove(task)}
              onCancelDelete={() => setPendingDelete(null)}
            />
          ))}
        </ul>
      )}

      {tab === "week" && tasks !== null && (
        <div className="mt-4">
          <WeekOverview children={children} tasks={tasks} onEditTask={openEdit} />
        </div>
      )}
    </div>
  );
}
