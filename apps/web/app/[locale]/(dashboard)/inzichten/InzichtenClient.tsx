"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { apiClient, ApiClientError } from "../../../../lib/api/client";
import { WeeklyInsightsResponse, type ChildInsights } from "../../../../lib/api/types";
import { useRouter } from "../../../../i18n/navigation";
import { Alert, Badge, Button, Card, ProgressBar } from "../../../../components/ui";

// Returns the Monday of the ISO week containing `date`.
function mondayOf(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day + 6) % 7; // days since Monday
  d.setDate(d.getDate() - diff);
  return d;
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addWeeks(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n * 7);
  return d;
}

function formatDate(isoDate: string, locale: string): string {
  const d = new Date(isoDate + "T00:00:00");
  return d.toLocaleDateString(locale === "nl" ? "nl-NL" : "en-GB", {
    day: "numeric",
    month: "long",
  });
}

// Stat pill — shows a label + value pair in a tight box.
function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-lg border border-border bg-bg px-3 py-2 text-center">
      <span className="text-xs text-muted">{label}</span>
      <span className="text-sm font-semibold text-text">{value}</span>
    </div>
  );
}

function ChildInsightCard({ child }: { child: ChildInsights }) {
  const t = useTranslations("inzichten");
  const pct = Math.round(child.completionRate * 100);

  const streakLabel =
    child.streakDays === 1 ? t("streakDaysOne") : t("streakDays", { days: child.streakDays });

  return (
    <Card padded={false} className="flex flex-col gap-5 p-5">
      {/* Header */}
      <div>
        <h2 className="text-base font-semibold text-text">{child.displayName}</h2>
      </div>

      {/* Point summary pills */}
      <div className="grid grid-cols-3 gap-2">
        <StatPill label={t("earned")} value={t("points", { points: child.earned })} />
        <StatPill label={t("spent")} value={t("points", { points: child.spent })} />
        <StatPill label={t("net")} value={t("points", { points: child.net })} />
      </div>

      {/* Completion bar */}
      <div>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="text-xs text-muted">{t("completion")}</span>
          <span className="text-xs font-semibold text-text">
            {t("tasksApproved", { approved: child.tasksApproved, total: child.tasksTotal })}
            {" · "}
            {t("completionValue", { pct })}
          </span>
        </div>
        <ProgressBar value={child.completionRate} max={1} tone="accent" />
      </div>

      {/* Streak */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted">{t("streak")}</span>
        <Badge tone={child.streakDays > 0 ? "success" : "neutral"}>{streakLabel}</Badge>
      </div>

      {/* Slipping tasks */}
      <div>
        <p className="text-xs font-semibold text-text">{t("slippingTitle")}</p>
        {child.slippingTasks.length === 0 ? (
          <p className="mt-2 text-xs text-muted">{t("noSlipping")}</p>
        ) : (
          <>
            <p className="mt-0.5 text-xs text-muted">{t("slippingHint")}</p>
            <ul className="mt-2 flex flex-col gap-1.5" aria-label={t("slippingTitle")}>
              {child.slippingTasks.map((task) => (
                <li
                  key={task.taskId}
                  className="flex items-center justify-between gap-2 rounded border border-border bg-bg px-3 py-2"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    {task.icon && (
                      <span className="shrink-0 text-base" aria-hidden>
                        {task.icon}
                      </span>
                    )}
                    <span className="truncate text-sm text-text">{task.title}</span>
                  </div>
                  <Badge tone="neutral">{t("slippingMissed", { count: task.missed })}</Badge>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Card>
  );
}

export default function InzichtenClient({ locale }: { locale: string }) {
  const t = useTranslations("inzichten");
  const router = useRouter();

  const todayMonday = toIsoDate(mondayOf(new Date()));
  const [weekOf, setWeekOf] = useState(todayMonday);
  const [data, setData] = useState<WeeklyInsightsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(
    async (week: string) => {
      setLoading(true);
      setFailed(false);
      try {
        const raw = await apiClient.get(
          `/api/v1/families/me/insights?range=week&weekOf=${week}`,
        );
        const parsed = WeeklyInsightsResponse.parse(raw);
        setData(parsed);
      } catch (err) {
        if (err instanceof ApiClientError && err.status === 401) {
          router.push("/login");
          return;
        }
        setFailed(true);
      } finally {
        setLoading(false);
      }
    },
    [router],
  );

  useEffect(() => {
    void load(weekOf);
  }, [load, weekOf]);

  function goWeek(delta: number) {
    const current = new Date(weekOf + "T00:00:00");
    setWeekOf(toIsoDate(addWeeks(current, delta)));
  }

  const isThisWeek = weekOf === todayMonday;
  const canGoNext = !isThisWeek;

  return (
    <div className="mx-auto max-w-4xl">
      {/* Page header */}
      <header className="mb-6">
        <h1 className="text-xl font-semibold text-text">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted">{t("subtitle")}</p>
      </header>

      {/* Week navigation */}
      <div className="mb-6 flex items-center gap-3">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => goWeek(-1)}
          aria-label={t("prevWeek")}
        >
          ← {t("prevWeek")}
        </Button>
        <span className="flex-1 text-center text-sm font-medium text-text" aria-live="polite">
          {isThisWeek ? t("thisWeek") : t("weekOf", { date: formatDate(weekOf, locale) })}
        </span>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => goWeek(1)}
          disabled={!canGoNext}
          aria-label={t("nextWeek")}
        >
          {t("nextWeek")} →
        </Button>
      </div>

      {/* Loading */}
      {loading && <p className="text-sm text-muted">{t("loading")}</p>}

      {/* Error */}
      {failed && !loading && (
        <div className="flex flex-col gap-3">
          <Alert tone="danger">{t("loadError")}</Alert>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => void load(weekOf)}
          >
            {t("retry")}
          </Button>
        </div>
      )}

      {/* Data */}
      {data && !loading && (
        <>
          {data.children.length === 0 ? (
            <p className="text-sm text-muted">{t("noChildren")}</p>
          ) : (
            <>
              {/* Side-by-side child cards — ordered by API (displayName/member order, never by score) */}
              <div
                className="grid gap-4"
                style={{
                  gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, 18rem), 1fr))`,
                }}
                aria-label={t("title")}
              >
                {data.children.map((child) => (
                  <ChildInsightCard key={child.childId} child={child} />
                ))}
              </div>

              {/* Contextual note */}
              <p className="mt-6 text-xs text-muted" role="note">
                {t("frameHint")}
              </p>
            </>
          )}
        </>
      )}

      {/* Empty week (data loaded but no entries) */}
      {data && !loading && data.children.length > 0 && data.children.every((c) => c.tasksTotal === 0) && (
        <p className="mt-4 text-sm text-muted">{t("empty")}</p>
      )}
    </div>
  );
}
