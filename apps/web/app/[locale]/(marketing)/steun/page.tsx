import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ButtonLink } from "../../../../components/ui";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("marketing.steunPage");
  return {
    title: t("metaTitle"),
    description: t("intro"),
  };
}

/** Parent-only support placeholder — no checkout until WS-DONATE (O18–O19). */
export default async function SteunPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("marketing.steunPage");
  const legal = await getTranslations("legal.links");

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="font-display text-2xl font-semibold text-text">{t("title")}</h1>
      <p className="mt-4 text-sm leading-relaxed text-muted md:text-base">{t("intro")}</p>
      <p className="mt-4 text-sm leading-relaxed text-muted md:text-base">{t("status")}</p>
      <p className="mt-8">
        <a href="mailto:steun@wispel.cc" className="text-sm font-medium text-accent hover:underline">
          {t("link")}
        </a>
      </p>
      <p className="mt-10 flex flex-wrap gap-4">
        <ButtonLink href="/" variant="secondary" size="sm">
          {t("back")}
        </ButtonLink>
        <ButtonLink href="/privacy" variant="ghost" size="sm">
          {legal("privacy")}
        </ButtonLink>
      </p>
    </main>
  );
}
