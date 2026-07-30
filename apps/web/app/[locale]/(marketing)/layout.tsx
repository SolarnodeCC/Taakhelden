import { getTranslations } from "next-intl/server";
import { Link } from "../../../i18n/navigation";
import LanguageSwitcher from "../LanguageSwitcher";

/**
 * Public marketing/legal chrome — parent-dashboard register, no AppShell.
 * Outside `(dashboard)`, so no auth gate.
 */
export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("legal");

  return (
    <div className="min-h-screen bg-bg text-text">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-6 py-4">
          <Link href="/login" className="text-lg font-semibold text-accent">
            Wispel
          </Link>
          <div className="flex items-center gap-4">
            <nav className="flex gap-3 text-sm">
              <Link href="/privacy" className="text-muted hover:text-text">
                {t("links.privacy")}
              </Link>
              <Link href="/voorwaarden" className="text-muted hover:text-text">
                {t("links.terms")}
              </Link>
            </nav>
            <LanguageSwitcher />
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
