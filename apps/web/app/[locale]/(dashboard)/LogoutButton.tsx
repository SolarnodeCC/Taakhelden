"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { apiClient } from "../../../lib/api/client";
import { useRouter } from "../../../i18n/navigation";

export default function LogoutButton() {
  const t = useTranslations("auth");
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onLogout() {
    setBusy(true);
    try {
      await apiClient.post("/api/auth/logout");
    } catch {
      // Even if the revoke call fails, the server clears cookies; go to login.
    }
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={onLogout}
      disabled={busy}
      className="rounded border border-border px-3 py-1.5 text-sm font-medium text-text transition-colors hover:bg-surface disabled:opacity-60"
    >
      {t("logout")}
    </button>
  );
}
