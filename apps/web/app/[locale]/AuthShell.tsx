import { getTranslations } from "next-intl/server";
import { Link } from "../../i18n/navigation";
import { WispelWordmark } from "../../components/brand";
import LanguageSwitcher from "./LanguageSwitcher";
import AuthLegalLinks from "./AuthLegalLinks";

type AuthShellProps = {
  children: React.ReactNode;
  /** Optional line under the wordmark (defaults to marketing auth promise). */
  promiseKey?: "login" | "register" | "accept";
};

/**
 * Branded auth entry — parent-calm register, atmosphere + mark + promise.
 * Shared by login / register / uitnodiging (WS-WEB-MKT full).
 */
export default async function AuthShell({ children, promiseKey = "login" }: AuthShellProps) {
  const t = await getTranslations("marketing.auth");

  return (
    <div className="relative min-h-screen overflow-hidden bg-surface text-text">
      <div className="mkt-hero-wash pointer-events-none absolute inset-0 opacity-80" aria-hidden />
      <header className="relative z-10 mx-auto flex max-w-lg items-center justify-between gap-4 px-6 py-4">
        <Link href="/" className="text-base font-semibold">
          <WispelWordmark markClassName="h-5 w-5" />
        </Link>
        <LanguageSwitcher />
      </header>
      <main className="relative z-10 mx-auto flex max-w-sm flex-col px-6 pb-16 pt-8">
        <h1 className="font-display text-2xl font-semibold">
          <WispelWordmark markClassName="h-7 w-7" />
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">{t(promiseKey)}</p>
        <div className="mt-8">{children}</div>
        <AuthLegalLinks />
      </main>
    </div>
  );
}
