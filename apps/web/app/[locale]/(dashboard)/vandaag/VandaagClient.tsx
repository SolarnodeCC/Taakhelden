"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { apiClient, ApiClientError } from "../../../../lib/api/client";
import { ParentTodayView, type ChildToday, type InstanceView } from "../../../../lib/api/types";
import { displayIcon } from "../../../../lib/icons";
import { useRealtimeRefetch } from "../../../../lib/realtime/FamilyRealtimeContext";
import { TODAY_REALTIME_EVENTS } from "../../../../lib/realtime/events";
import { useRouter } from "../../../../i18n/navigation";
import {
  ButtonLink,
  Card,
  EmptyState,
  PageError,
  SkeletonRows,
} from "../../../../components/ui";

type Bucket = "open" | "awaiting" | "done";

// Map the API's instance status onto the three columns a parent cares about.
// Positive framing only (stijlgids §3.7): "af", never "te laat" / red crosses.
function bucketOf(status: InstanceView["status"]): Bucket {
  switch (status) {
    case "submitted":
      return "awaiting";
    case "approved":
    case "completed":
      return "done";
    default:
      return "open"; // open, open_redo
  }
}

function ChildCard({ child }: { child: ChildToday }) {
  const t = useTranslations("vandaag");
  const buckets: Record<Bucket, InstanceView[]> = { open: [], awaiting: [], done: [] };
  for (const inst of child.instances) buckets[bucketOf(inst.status)].push(inst);

  const order: Bucket[] = ["open", "awaiting", "done"];
  const hasAny = child.instances.length > 0;

  return (
    <section>
      <Card variant="row">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-text">{child.displayName}</h2>
          <span className="rounded-full bg-accent/10 px-3 py-1 text-sm font-semibold text-accent-on-tint">
            {t("balance", { points: child.balance.balance })}
          </span>
        </div>

        {!hasAny ? (
          <p className="mt-3 text-sm text-muted">{t("childEmpty")}</p>
        ) : (
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            {order.map((bucket) => (
              <div key={bucket}>
                <h3 className="text-sm font-semibold text-muted">
                  {t(`bucket.${bucket}`)}
                </h3>
                <ul className="mt-2 flex flex-col gap-2">
                  {buckets[bucket].length === 0 ? (
                    <li className="text-sm text-muted">—</li>
                  ) : (
                    buckets[bucket].map((inst) => (
                      <li
                        key={inst.id}
                        className="flex items-center gap-2 rounded bg-bg px-2 py-2 text-sm text-text"
                      >
                        {displayIcon(inst.icon) && <span aria-hidden>{displayIcon(inst.icon)}</span>}
                        <span className="min-w-0 truncate">{inst.title}</span>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Card>
    </section>
  );
}

export default function VandaagClient() {
  const t = useTranslations("vandaag");
  const router = useRouter();
  const [children, setChildren] = useState<ChildToday[] | null>(null);
  const [failed, setFailed] = useState(false);
  const hadDataRef = useRef(false);

  const loadToday = useCallback(async () => {
    try {
      const raw = await apiClient.get("/api/v1/instances/today");
      const today = ParentTodayView.parse(raw);
      setChildren(today.children);
      hadDataRef.current = true;
      setFailed(false);
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 401) {
        router.push("/login");
        return;
      }
      if (!hadDataRef.current) setFailed(true);
    }
  }, [router]);

  useEffect(() => {
    void loadToday();
  }, [loadToday]);

  useRealtimeRefetch(TODAY_REALTIME_EVENTS, loadToday);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-text">{t("title")}</h1>

      {failed && (
        <div className="mt-4">
          <PageError message={t("loadError")} onRetry={() => void loadToday()} />
        </div>
      )}

      <div className="mt-4" aria-busy={!failed && children === null}>
        {!failed && children === null && <SkeletonRows count={2} />}

        {children !== null && children.length === 0 && (
          <EmptyState
            title={t("emptyTitle")}
            body={t("emptyBody")}
            action={<ButtonLink href="/gezin">{t("emptyAction")}</ButtonLink>}
          />
        )}

        {children !== null && children.length > 0 && (
          <div className="flex flex-col gap-4">
            {children.map((child) => (
              <ChildCard key={child.childId} child={child} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
