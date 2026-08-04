"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "../../../i18n/navigation";
import { apiClient, ApiClientError } from "../../../lib/api/client";
import {
  FamilyView,
  MemberList,
  SessionInfo,
  type MemberView,
} from "../../../lib/api/types";
import { NavIcon, WispelWordmark } from "../../../components/brand";
import {
  FamilyRealtimeProvider,
  useFamilyRealtime,
} from "../../../lib/realtime/FamilyRealtimeContext";
import { FAMILY_UPDATED_EVENT } from "./gezin/FamilySettingsForm";
import { NAV_ITEMS } from "./nav";
import LanguageSwitcher from "../LanguageSwitcher";
import LogoutButton from "./LogoutButton";

interface ShellData {
  familyName: string;
  userName: string;
  permissions: "full" | "approve_only";
  children: MemberView[];
}

function ShellRealtimeStatus() {
  const t = useTranslations("shell.realtime");
  const { status } = useFamilyRealtime();

  if (status === "connected") return null;

  return (
    <p className="text-xs text-muted" role="status">
      {status === "connecting" ? t("connecting") : t("offline")}
    </p>
  );
}

function AppShellInner({ children }: { children: React.ReactNode }) {
  const t = useTranslations("shell");
  const tNav = useTranslations("nav");
  const pathname = usePathname();
  const router = useRouter();

  const [data, setData] = useState<ShellData | null>(null);
  const [failed, setFailed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const loadShell = useCallback(async () => {
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
      setData({
        familyName: family.name,
        userName: me?.displayName ?? "",
        permissions: session.permissions,
        children: members.filter((m) => m.role === "child"),
      });
      setFailed(false);
    } catch (err) {
      // An expired/revoked session can't be recovered here — send the parent to
      // login rather than leaving them on a shell that only shows an error.
      if (err instanceof ApiClientError && err.status === 401) {
        router.push("/login");
        return;
      }
      setFailed(true);
    }
  }, [router]);

  useEffect(() => {
    void loadShell();
  }, [loadShell]);

  useEffect(() => {
    function onFamilyUpdated() {
      void loadShell();
    }
    window.addEventListener(FAMILY_UPDATED_EVENT, onFamilyUpdated);
    return () => window.removeEventListener(FAMILY_UPDATED_EVENT, onFamilyUpdated);
  }, [loadShell]);

  // Close sidebar on Escape and restore focus to the hamburger button.
  useEffect(() => {
    if (!menuOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  // Trap focus inside sidebar when it is open on mobile.
  useEffect(() => {
    if (!menuOpen) return;
    const sidebar = sidebarRef.current;
    if (!sidebar) return;
    const focusable = sidebar.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    first?.focus();
    function trap(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    }
    document.addEventListener("keydown", trap);
    return () => document.removeEventListener("keydown", trap);
  }, [menuOpen]);

  // Until permissions are known, show only the ungated items so we never flash
  // management sections to an approve_only parent.
  const visibleNav = NAV_ITEMS.filter(
    (item) => !item.requiresFull || data?.permissions === "full",
  );

  const sidebarContent = (
    <>
      <div className="px-5 py-5">
        <WispelWordmark markClassName="h-6 w-6" />
      </div>
      <nav className="flex flex-col gap-1 px-2" aria-label={t("nav")}>
        {visibleNav.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.key}
              href={item.href}
              aria-current={active ? "page" : undefined}
              onClick={() => setMenuOpen(false)}
              className={
                "inline-flex min-h-11 items-center gap-2.5 rounded px-3 py-2 text-sm font-medium transition-colors " +
                (active ? "bg-accent text-accent-fg" : "text-text hover:bg-border/50")
              }
            >
              <NavIcon name={item.key} />
              {tNav(item.key)}
            </Link>
          );
        })}
      </nav>
    </>
  );

  return (
    <div className="flex min-h-screen">
      {/* Bypass block (WCAG 2.4.1) — first focusable element in the shell. */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:border focus:border-border-interactive focus:bg-bg focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-text"
      >
        {t("skipToContent")}
      </a>

      {/* ── Mobile backdrop ── */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-30 bg-text/20 sm:hidden"
          aria-hidden="true"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* ── Sidebar (desktop: always visible; mobile: drawer) ──
       * Closed on mobile it is `hidden`, i.e. display:none — so its links leave
       * both the tab order and the accessibility tree (WCAG 2.4.3). Toggling
       * display rules out a transform transition, hence the mount animation;
       * the global reduced-motion policy neutralises it. The element is always
       * in the DOM, so the hamburger's aria-controls always resolves. Landmark
       * duty belongs to the inner <nav> alone — a labelled <aside> around it
       * would announce the same name twice.
       */}
      <div
        id="sidebar"
        ref={sidebarRef}
        className={[
          "w-60 shrink-0 flex-col border-r border-border bg-surface",
          // Mobile: fixed overlay above the backdrop, only while open.
          "fixed inset-y-0 left-0 z-40",
          menuOpen ? "flex motion-safe:animate-drawer-in" : "hidden",
          // Desktop: static, always visible.
          "sm:relative sm:flex sm:animate-none",
        ].join(" ")}
      >
        {sidebarContent}
      </div>

      {/* ── Main area ── */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-border px-4 py-4 sm:px-6">
          {/* Hamburger — mobile only */}
          <button
            ref={menuButtonRef}
            type="button"
            aria-label={menuOpen ? t("menuClose") : t("menuOpen")}
            aria-expanded={menuOpen}
            aria-controls="sidebar"
            onClick={() => setMenuOpen((prev) => !prev)}
            className="inline-flex h-11 w-11 items-center justify-center rounded text-text hover:bg-border/50 sm:hidden"
          >
            {/* Hamburger / X icon via SVG — no raw hex, uses currentColor */}
            {menuOpen ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-text">
              {data ? data.familyName : failed ? t("loadError") : t("loading")}
            </p>
            {data?.userName && (
              <p className="truncate text-xs text-muted">
                {t("greeting", { name: data.userName })}
              </p>
            )}
            <ShellRealtimeStatus />
          </div>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <LogoutButton />
          </div>
        </header>

        {/* One container for every screen — pages no longer pick their own
         * width or alignment, so the title stays put as the parent navigates. */}
        {/* `tabIndex={-1}` exists only so the skip link can land here; the ring
            is suppressed because this focus is programmatic, never user-driven. */}
        <main
          id="main"
          tabIndex={-1}
          className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 focus:outline-none sm:px-6 sm:py-8"
        >
          {children}
        </main>
      </div>
    </div>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <FamilyRealtimeProvider>
      <AppShellInner>{children}</AppShellInner>
    </FamilyRealtimeProvider>
  );
}
