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
} from "../../../../lib/api/types";
import { useRouter } from "../../../../i18n/navigation";
import { Button } from "../../../../components/ui";
import TaskForm from "./TaskForm";

type FormState = { mode: "create" } | { mode: "edit"; task: TaskView } | null;

function TaskRow({
  task,
  childName,
  onEdit,
  onDelete,
}: {
  task: TaskView;
  childName: (id: string) => string;
  onEdit: () => void;
  onDelete: () => void;
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

  return (
    <li className="flex items-start justify-between gap-3 rounded-lg border border-border bg-surface p-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {task.icon && <span aria-hidden>{task.icon}</span>}
          <h2 className="truncate text-base font-semibold text-text">{task.title}</h2>
        </div>
        <p className="mt-0.5 text-sm text-muted">
          {t("points", { points: task.points })} · {t(`category.${task.category}`)} · {recurrence}
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {task.assignees.map((id) => (
            <span key={id} className="rounded-full bg-bg px-2 py-0.5 text-xs text-muted">
              {childName(id)}
            </span>
          ))}
          {task.approvalRequired && (
            <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent">
              {t("badge.approval")}
            </span>
          )}
          {task.photoBonusPoints > 0 && (
            <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent">
              {t("badge.photoBonus", { points: task.photoBonusPoints })}
            </span>
          )}
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={onEdit}
          className="rounded border border-border px-3 py-1.5 text-sm font-medium text-text transition-colors hover:bg-bg"
        >
          {t("edit")}
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="rounded border border-border px-3 py-1.5 text-sm font-medium text-danger transition-colors hover:bg-bg"
        >
          {t("delete")}
        </button>
      </div>
    </li>
  );
}

export default function TakenClient() {
  const t = useTranslations("taken");
  const router = useRouter();
  const [tasks, setTasks] = useState<TaskView[] | null>(null);
  const [children, setChildren] = useState<MemberView[]>([]);
  const [failed, setFailed] = useState(false);
  const [form, setForm] = useState<FormState>(null);

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
    void load();
  }, [load]);

  const childName = useCallback(
    (id: string) => children.find((c) => c.id === id)?.displayName ?? "—",
    [children],
  );

  async function submit(payload: TaskFormPayload) {
    if (form?.mode === "edit") {
      await apiClient.patch(`/api/v1/tasks/${form.task.id}`, payload);
    } else {
      await apiClient.post("/api/v1/tasks", payload);
    }
    setForm(null);
    await load();
  }

  async function remove(task: TaskView) {
    if (!window.confirm(t("deleteConfirm"))) return;
    try {
      await apiClient.delete(`/api/v1/tasks/${task.id}`);
      setTasks((prev) => (prev ? prev.filter((x) => x.id !== task.id) : prev));
    } catch {
      setFailed(true);
    }
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-text">{t("title")}</h1>
        {form === null && (
          <Button type="button" onClick={() => setForm({ mode: "create" })}>
            {t("newTask")}
          </Button>
        )}
      </div>

      {failed && <p className="mt-4 text-sm text-danger">{t("loadError")}</p>}

      {form !== null && (
        <div className="mt-4">
          <TaskForm
            children={children}
            initial={form.mode === "edit" ? form.task : undefined}
            onSubmit={submit}
            onCancel={() => setForm(null)}
          />
        </div>
      )}

      {!failed && tasks === null && <p className="mt-4 text-sm text-muted">{t("loading")}</p>}

      {tasks !== null && tasks.length === 0 && form === null && (
        <p className="mt-4 text-sm text-muted">{t("empty")}</p>
      )}

      {tasks !== null && tasks.length > 0 && (
        <ul className="mt-4 flex flex-col gap-3">
          {tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              childName={childName}
              onEdit={() => setForm({ mode: "edit", task })}
              onDelete={() => remove(task)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
