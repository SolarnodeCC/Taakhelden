import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link, redirect } from "../../../i18n/navigation";
import { WispelMark, WispelWordmark } from "../../../components/brand";
import { isAuthenticated } from "../../../lib/auth/session";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("marketing");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

/**
 * Thin public landing (WS-WEB-MKT Horizon A). Authenticated parents skip to the
 * dashboard — this route owns `/[locale]` after removing the dashboard index.
 */
export default async function MarketingHomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  if (await isAuthenticated()) {
    redirect({ href: "/vandaag", locale });
  }

  const t = await getTranslations("marketing");
  const faq = t.raw("faq.items") as { q: string; a: string }[];

  return (
    <div>
      {/* Hero — one composition: brand, promise, CTA, dominant visual plane */}
      <section className="relative overflow-hidden border-b border-border bg-surface">
        <div className="mkt-hero-wash pointer-events-none absolute inset-0 opacity-90" aria-hidden />
        <div className="relative mx-auto grid max-w-5xl items-center gap-10 px-6 py-16 md:grid-cols-2 md:gap-12 md:py-24">
          <div className="mkt-rise">
            <p className="font-display text-4xl font-bold tracking-tight text-accent md:text-5xl">
              <WispelWordmark
                className="inline-flex items-center gap-3 text-accent"
                markClassName="h-10 w-10 md:h-12 md:w-12"
              />
            </p>
            <h1 className="mkt-rise mkt-rise-delay-1 mt-6 font-display text-3xl font-semibold leading-tight text-text md:text-4xl">
              {t("headline")}
            </h1>
            <p className="mkt-rise mkt-rise-delay-2 mt-4 max-w-md text-base leading-relaxed text-muted md:text-lg">
              {t("support")}
            </p>
            <div className="mkt-rise mkt-rise-delay-3 mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/register"
                className="inline-flex items-center justify-center rounded border border-accent bg-accent px-6 py-3 text-base font-semibold text-accent-fg transition-colors hover:bg-accent-hover"
              >
                {t("ctaPrimary")}
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded border border-border bg-bg px-6 py-3 text-base font-semibold text-text transition-colors hover:bg-surface"
              >
                {t("ctaSecondary")}
              </Link>
            </div>
          </div>

          {/* Temp product visual — not a card; edge-to-edge plane on small screens */}
          <div
            className="mkt-rise mkt-rise-delay-2 relative min-h-[16rem] rounded-xl bg-kid-cream md:min-h-[20rem]"
            aria-hidden
          >
            <div className="absolute inset-6 flex flex-col justify-between rounded-lg bg-bg/80 p-5 md:inset-8 md:p-6">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted">{t("visual.dayLabel")}</p>
                <p className="mt-2 text-xl font-semibold text-text">{t("visual.starLabel")}</p>
              </div>
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-3xl font-bold text-accent">12</p>
                  <p className="text-sm text-muted">{t("visual.pointsLabel")}</p>
                </div>
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-kid-turquoise-soft text-accent">
                  <WispelMark className="h-8 w-8" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-14">
        <h2 className="text-xl font-semibold text-text">{t("privacy.title")}</h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted md:text-base">{t("privacy.body")}</p>
        <p className="mt-4">
          <Link href="/privacy" className="text-sm font-medium text-accent hover:underline">
            {t("privacy.link")}
          </Link>
        </p>
      </section>

      <section className="border-t border-border bg-surface">
        <div className="mx-auto max-w-5xl px-6 py-14">
          <h2 className="text-xl font-semibold text-text">{t("faq.title")}</h2>
          <dl className="mt-8 max-w-2xl space-y-6">
            {faq.map((item) => (
              <div key={item.q}>
                <dt className="text-sm font-semibold text-text">{item.q}</dt>
                <dd className="mt-1 text-sm leading-relaxed text-muted">{item.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="border-t border-border">
        <div className="mx-auto max-w-5xl px-6 py-14">
          <h2 className="text-xl font-semibold text-text">{t("steun.title")}</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted md:text-base">{t("steun.body")}</p>
          <p className="mt-4">
            <a href="mailto:steun@wispel.cc" className="text-sm font-medium text-accent hover:underline">
              {t("steun.link")}
            </a>
          </p>
        </div>
      </section>

      <footer className="border-t border-border bg-surface">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-6 text-sm text-muted">
          <p>{t("footer.tagline")}</p>
          <nav className="flex gap-4">
            <Link href="/privacy" className="hover:text-text">
              {t("footer.privacy")}
            </Link>
            <Link href="/voorwaarden" className="hover:text-text">
              {t("footer.terms")}
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
