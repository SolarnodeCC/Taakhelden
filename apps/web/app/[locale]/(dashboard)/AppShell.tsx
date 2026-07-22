"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "../../../i18n/navigation";
import { apiClient } from "../../../lib/api/client";
import {
  FamilyView,
  MemberList,
  SessionInfo,
  type MemberView,
} from "../../../lib/api/types";
import { NAV_ITEMS } from "./nav";
import LanguageSwitcher from "../LanguageSwitcher";
import LogoutButton from "./LogoutButton";

interface ShellData {
  familyName: string;
  userName: string;
  permissions: "full" | "approve_only";
  children: MemberView[];
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations("shell");
  const tNav = useTranslations("nav");
  const pathname = usePathname();

  const [data, setData] = useState<ShellData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [sessionRaw, familyRaw, membersRaw] = await Promise.all([
          apiClient.get("/api/session"),
          apiClient.get("/api/v1/families/me"),
          apiClient.get("/api/v1/members"),
        ]);
        const session = SessionInfo.parse(sessionRaw);
        const family = FamilyView.parse(familyRaw);
        const members = MemberList.parse(membersRaw);
        const me = members.find((m) => m.id === session.userId);
        if (!active) return;
        setData({
          familyName: family.name,
          userName: me?.displayName ?? "",
          permissions: session.permissions,
          children: members.filter((m) => m.role === "child"),
        });
      } catch {
        if (active) setFailed(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Until permissions are known, show only the ungated items so we never flash
  // management sections to an approve_only parent.
  const visibleNav = NAV_ITEMS.filter(
    (item) => !item.requiresFull || data?.permissions === "full",
  );

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-surface">
        <div className="px-5 py-5 text-lg font-semibold text-accent">TaakHelden</div>
        <nav className="flex flex-col gap-1 px-2">
          {visibleNav.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.key}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={
                  "rounded px-3 py-2 text-sm font-medium transition-colors " +
                  (active
                    ? "bg-accent text-accent-fg"
                    : "text-text hover:bg-border/50")
                }
              >
                {tNav(item.key)}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-text">
              {data ? data.familyName : failed ? t("loadError") : t("loading")}
            </p>
            {data?.userName && (
              <p className="truncate text-xs text-muted">
                {t("greeting", { name: data.userName })}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <LogoutButton />
          </div>
        </header>

        <main className="flex-1 px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
