"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { apiClient, ApiClientError } from "../../../../lib/api/client";
import { ParentTodayView, type ChildToday, type InstanceView } from "../../../../lib/api/types";
import { useRouter } from "../../../../i18n/navigation";

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
    <section className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-text">{child.displayName}</h2>
        <span className="rounded-full bg-accent/10 px-3 py-1 text-sm font-semibold text-accent">
          {t("balance", { points: child.balance })}
        </span>
      </div>

      {!hasAny ? (
        <p className="mt-3 text-sm text-muted">{t("childEmpty")}</p>
      ) : (
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          {order.map((bucket) => (
            <div key={bucket}>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
                {t(`bucket.${bucket}`)}
              </h3>
              <ul className="mt-2 flex flex-col gap-1.5">
                {buckets[bucket].length === 0 ? (
                  <li className="text-sm text-muted/70">—</li>
                ) : (
                  buckets[bucket].map((inst) => (
                    <li
                      key={inst.id}
                      className="flex items-center gap-2 rounded bg-bg px-2 py-1.5 text-sm text-text"
                    >
                      {inst.icon && <span aria-hidden>{inst.icon}</span>}
                      <span className="min-w-0 truncate">{inst.title}</span>
                    </li>
                  ))
                )}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function VandaagClient() {
  const t = useTranslations("vandaag");
  const router = useRouter();
  const [children, setChildren] = useState<ChildToday[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const raw = await apiClient.get("/api/v1/instances/today");
        const today = ParentTodayView.parse(raw);
        if (active) setChildren(today.children);
      } catch (err) {
        if (!active) return;
        if (err instanceof ApiClientError && err.status === 401) {
          router.push("/login");
          return;
        }
        setFailed(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [router]);

  return (
    <div className="max-w-4xl">
      <h1 className="text-xl font-semibold text-text">{t("title")}</h1>

      {failed && <p className="mt-4 text-sm text-danger">{t("loadError")}</p>}

      {!failed && children === null && <p className="mt-4 text-sm text-muted">{t("loading")}</p>}

      {children !== null && children.length === 0 && (
        <p className="mt-4 text-sm text-muted">{t("noChildren")}</p>
      )}

      {children !== null && children.length > 0 && (
        <div className="mt-4 flex flex-col gap-4">
          {children.map((child) => (
            <ChildCard key={child.childId} child={child} />
          ))}
        </div>
      )}
    </div>
  );
}
