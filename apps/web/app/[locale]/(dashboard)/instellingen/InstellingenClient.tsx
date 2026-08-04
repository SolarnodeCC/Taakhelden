"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { apiClient, ApiClientError } from "../../../../lib/api/client";
import { FamilyView, MemberList, MemberView } from "../../../../lib/api/types";
import {
  FullParentForbidden,
  FullParentUpstreamError,
  useRequireFullParent,
} from "../../../../lib/auth/RequireFullParent";
import { useRouter } from "../../../../i18n/navigation";
import NotificationSettingsSection from "./NotificationSettingsSection";
import PrivacySection from "./PrivacySection";
import { PageError, SkeletonRows } from "../../../../components/ui";
import SteunSection from "./SteunSection";

export default function InstellingenClient() {
  const t = useTranslations("instellingen");
  const router = useRouter();
  const gate = useRequireFullParent();

  const [family, setFamily] = useState<FamilyView | null>(null);
  const [children, setChildren] = useState<MemberView[]>([]);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const [familyRaw, membersRaw] = await Promise.all([
        apiClient.get("/api/v1/families/me"),
        apiClient.get("/api/v1/members"),
      ]);
      setFamily(FamilyView.parse(familyRaw));
      setChildren(MemberList.parse(membersRaw).filter((m) => m.role === "child"));
      setFailed(false);
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

  if (gate === "forbidden") return <FullParentForbidden />;
  if (gate === "upstream_error") return <FullParentUpstreamError />;

  if (gate === "loading" || (!family && !failed)) {
    return (
      <div aria-busy>
        <SkeletonRows count={3} />
      </div>
    );
  }

  if (failed || !family) {
    return <PageError message={t("loadError")} onRetry={() => void load()} />;
  }

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <header>
        <h1 className="text-2xl font-semibold text-text">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted">{t("subtitle")}</p>
      </header>

      <NotificationSettingsSection
        childMembers={children}
        familyQuietStart={family.quietStart}
        familyQuietEnd={family.quietEnd}
      />

      <SteunSection />

      <PrivacySection />
    </div>
  );
}
