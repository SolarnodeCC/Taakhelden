"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { apiClient, ApiClientError } from "../api/client";
import { SessionInfo } from "../api/types";
import { Link, useRouter } from "../../i18n/navigation";
import { Alert, Button } from "../../components/ui";

export type FullParentGate = "loading" | "ok" | "forbidden" | "upstream_error";

/**
 * Client-side gate for pages that require `permissions === "full"`.
 * Shared by Gezin / Taken / Winkel / Instellingen so approve_only parents
 * cannot reach CRUD via a direct URL (nav already hides those items).
 *
 * Distinguishes:
 *   - 403 → forbidden (user genuinely lacks permission)
 *   - 5xx / network → upstream_error (retryable, NOT forbidden)
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
        if (err instanceof ApiClientError) {
          if (err.status === 401) {
            router.push("/login");
            return;
          }
          if (err.status === 403) {
            setGate("forbidden");
            return;
          }
        }
        // 5xx, network, or unexpected error — show retryable state, not forbidden.
        setGate("upstream_error");
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

export function FullParentUpstreamError() {
  const t = useTranslations("guards");
  return (
    <div className="mx-auto max-w-lg">
      <Alert tone="danger">{t("upstreamUnavailable")}</Alert>
      <div className="mt-4">
        <Button type="button" variant="secondary" onClick={() => window.location.reload()}>
          {t("retry")}
        </Button>
      </div>
    </div>
  );
}
