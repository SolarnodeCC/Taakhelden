import { getTranslations } from "next-intl/server";
import { Link } from "../../../i18n/navigation";
import { WispelWordmark } from "../../../components/brand";
import LanguageSwitcher from "../LanguageSwitcher";

/**
 * Public marketing/legal chrome — parent-dashboard register, no AppShell.
 * Outside `(dashboard)`, so no auth gate.
 */
export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("legal");
  const m = await getTranslations("marketing");

  return (
    <div className="min-h-screen bg-bg text-text">
      <header className="border-b border-border bg-bg/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
          <Link href="/" className="text-lg font-semibold">
            <WispelWordmark markClassName="h-6 w-6" />
          </Link>
          <div className="flex items-center gap-3 sm:gap-4">
            <nav className="hidden gap-3 text-sm sm:flex">
              <Link href="/privacy" className="text-muted hover:text-text">
                {t("links.privacy")}
              </Link>
              <Link href="/voorwaarden" className="text-muted hover:text-text">
                {t("links.terms")}
              </Link>
            </nav>
            <Link href="/login" className="text-sm font-medium text-muted hover:text-text">
              {m("nav.login")}
            </Link>
            <Link
              href="/register"
              className="hidden rounded border border-accent bg-accent px-3 py-1.5 text-sm font-semibold text-accent-fg transition-colors hover:bg-accent-hover sm:inline-flex"
            >
              {m("nav.cta")}
            </Link>
            <LanguageSwitcher />
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
