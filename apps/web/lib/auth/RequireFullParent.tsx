"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { apiClient, ApiClientError } from "../api/client";
import { SessionInfo } from "../api/types";
import { Link, useRouter } from "../../i18n/navigation";
import { Alert } from "../../components/ui";

export type FullParentGate = "loading" | "ok" | "forbidden";

/**
 * Client-side gate for pages that require `permissions === "full"`.
 * Shared by Gezin / Taken / Winkel so approve_only parents cannot reach
 * CRUD via a direct URL (nav already hides those items).
 */
export function useRequireFullParent(): FullParentGate {
  const router = useRouter();
  const [gate, setGate] = useState<FullParentGate>("loading");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const session = SessionInfo.parse(await apiClient.get("/api/session"));
        if (!active) return;
        setGate(session.permissions === "full" ? "ok" : "forbidden");
      } catch (err) {
        if (!active) return;
        if (err instanceof ApiClientError && err.status === 401) {
          router.push("/login");
          return;
        }
        setGate("forbidden");
      }
    })();
    return () => {
      active = false;
    };
  }, [router]);

  return gate;
}

export function FullParentForbidden() {
  const t = useTranslations("guards");
  return (
    <div className="mx-auto max-w-lg">
      <Alert tone="danger">{t("forbidden")}</Alert>
      <p className="mt-4">
        <Link href="/vandaag" className="font-medium text-accent hover:underline">
          {t("backToToday")}
        </Link>
      </p>
    </div>
  );
}
