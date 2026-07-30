import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link, redirect } from "../../../i18n/navigation";
import { WispelMark, WispelWordmark } from "../../../components/brand";
import { ButtonLink } from "../../../components/ui";
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
    openGraph: {
      title: t("metaTitle"),
      description: t("metaDescription"),
      images: [{ url: "/brand/icon.svg", width: 128, height: 128, alt: "Wispel" }],
    },
  };
}

type Step = { title: string; body: string };
type AudienceList = string[];

/**
 * Full marketing landing (WS-WEB-MKT Horizon B) — acquisition depth in Wispel voice.
 * Authenticated parents skip to the dashboard.
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
  const steps = t.raw("howItWorks.steps") as Step[];
  const forItems = t.raw("audience.forItems") as AudienceList;
  const notForItems = t.raw("audience.notForItems") as AudienceList;
  const faq = t.raw("faq.items") as { q: string; a: string }[];
  const privacyPoints = t.raw("privacy.points") as string[];

  return (
    <div>
      {/* Hero — one composition only */}
      <section className="relative overflow-hidden border-b border-border bg-surface">
        <div className="mkt-hero-wash pointer-events-none absolute inset-0 opacity-90" aria-hidden />
        <div className="relative mx-auto grid max-w-5xl items-center gap-10 px-6 py-16 md:grid-cols-2 md:gap-12 md:py-16">
          <div className="mkt-rise">
            <p className="font-display text-4xl font-bold tracking-tight text-accent">
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
              <ButtonLink href="/register" size="lg">
                {t("ctaPrimary")}
              </ButtonLink>
              <ButtonLink href="/login" variant="secondary" size="lg">
                {t("ctaSecondary")}
              </ButtonLink>
            </div>
            <p className="mkt-rise mkt-rise-delay-3 mt-4">
              <Link href="/steun" className="text-sm text-muted hover:text-accent hover:underline">
                {t("ctaSteun")}
              </Link>
            </p>
          </div>

          <div
            className="mkt-rise mkt-rise-delay-2 relative min-h-64 overflow-hidden rounded-xl bg-kid-cream md:min-h-80"
            role="img"
            aria-label={t("visual.starLabel")}
          >
            <div className="absolute inset-6 flex flex-col justify-between rounded-lg bg-bg/80 p-5 md:inset-8 md:p-6">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted">{t("visual.dayLabel")}</p>
                <p className="mt-2 font-display text-xl font-semibold text-text">{t("visual.starLabel")}</p>
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

      {/* How it works */}
      <section className="mx-auto max-w-5xl px-6 py-12">
        <h2 className="font-display text-2xl font-semibold text-text">{t("howItWorks.title")}</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted md:text-base">{t("howItWorks.support")}</p>
        <ol className="mt-10 grid gap-10 md:grid-cols-3 md:gap-8">
          {steps.map((step, i) => (
            <li key={step.title}>
              <p className="font-display text-sm font-semibold text-accent">{String(i + 1).padStart(2, "0")}</p>
              <h3 className="mt-2 text-base font-semibold text-text">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Product kinship: kid warmth + parent calm */}
      <section className="border-t border-border bg-surface">
        <div className="mx-auto max-w-5xl px-6 py-12">
          <h2 className="font-display text-2xl font-semibold text-text">{t("preview.title")}</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted md:text-base">{t("preview.support")}</p>
          <div className="mt-10 grid gap-8 md:grid-cols-2">
            <div className="rounded-xl bg-kid-cream p-6" role="img" aria-label={t("preview.kidLabel")}>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">{t("preview.kidLabel")}</p>
              <p className="mt-3 font-rounded text-lg font-semibold text-kid-text">{t("preview.kidLine")}</p>
              <div className="mt-6 space-y-3">
                <div className="rounded-lg bg-bg/90 px-4 py-3 text-sm text-kid-text shadow-kid">
                  {t("preview.kidTask1")}
                </div>
                <div className="rounded-lg bg-bg/90 px-4 py-3 text-sm text-kid-text shadow-kid">
                  {t("preview.kidTask2")}
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-bg p-6" role="img" aria-label={t("preview.parentLabel")}>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">{t("preview.parentLabel")}</p>
              <p className="mt-3 text-lg font-semibold text-text">{t("preview.parentLine")}</p>
              <div className="mt-6 space-y-3">
                <div className="rounded border border-border px-4 py-3 text-sm text-text">
                  {t("preview.parentItem1")}
                </div>
                <div className="rounded border border-border px-4 py-3 text-sm text-text">
                  {t("preview.parentItem2")}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Privacy */}
      <section className="mx-auto max-w-5xl px-6 py-12">
        <h2 className="font-display text-2xl font-semibold text-text">{t("privacy.title")}</h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted md:text-base">{t("privacy.body")}</p>
        <ul className="mt-6 max-w-2xl list-disc space-y-2 pl-5 text-sm text-muted">
          {privacyPoints.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
        <p className="mt-4">
          <Link href="/privacy" className="text-sm font-medium text-accent hover:underline">
            {t("privacy.link")}
          </Link>
        </p>
      </section>

      {/* Gratis + steun — not a price table */}
      <section className="border-t border-border bg-surface">
        <div className="mx-auto max-w-5xl px-6 py-12">
          <h2 className="font-display text-2xl font-semibold text-text">{t("gratis.title")}</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted md:text-base">{t("gratis.body")}</p>
          <h3 className="mt-10 text-base font-semibold text-text">{t("steun.title")}</h3>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted md:text-base">{t("steun.body")}</p>
          <p className="mt-4 flex flex-wrap gap-4">
            <Link href="/steun" className="text-sm font-medium text-accent hover:underline">
              {t("steun.title")}
            </Link>
            <a href="mailto:steun@wispel.cc" className="text-sm font-medium text-accent hover:underline">
              {t("steun.link")}
            </a>
          </p>
        </div>
      </section>

      {/* For / not for */}
      <section className="mx-auto max-w-5xl px-6 py-12">
        <h2 className="font-display text-2xl font-semibold text-text">{t("audience.title")}</h2>
        <div className="mt-8 grid gap-10 md:grid-cols-2">
          <div>
            <h3 className="text-base font-semibold text-text">{t("audience.forTitle")}</h3>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted">
              {forItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-base font-semibold text-text">{t("audience.notForTitle")}</h3>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted">
              {notForItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-border bg-surface">
        <div className="mx-auto max-w-5xl px-6 py-12">
          <h2 className="font-display text-2xl font-semibold text-text">{t("faq.title")}</h2>
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

      {/* Final CTA */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-5xl px-6 py-16 text-center">
          <h2 className="font-display text-2xl font-semibold text-text md:text-3xl">{t("finalCta.title")}</h2>
          <p className="mx-auto mt-3 max-w-lg text-sm text-muted md:text-base">{t("finalCta.support")}</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <ButtonLink href="/register" size="lg">
              {t("ctaPrimary")}
            </ButtonLink>
            <ButtonLink href="/login" variant="secondary" size="lg">
              {t("ctaSecondary")}
            </ButtonLink>
          </div>
        </div>
      </section>

      <footer className="border-t border-border bg-surface">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-6 text-sm text-muted">
          <p>{t("footer.tagline")}</p>
          <nav className="flex flex-wrap gap-4">
            <Link href="/privacy" className="hover:text-text">
              {t("footer.privacy")}
            </Link>
            <Link href="/voorwaarden" className="hover:text-text">
              {t("footer.terms")}
            </Link>
            <Link href="/steun" className="hover:text-text">
              {t("footer.steun")}
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
