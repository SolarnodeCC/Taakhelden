import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import GoedkeurenClient from "./GoedkeurenClient";

// Titles come from the `nav` namespace so the browser tab, the sidebar label and
// the bookmark stay in sync — and stay localised. The root layout supplies the
// " — Wispel" suffix via its title template.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "nav" });
  return { title: t("goedkeuren") };
}

export default async function GoedkeurenPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <GoedkeurenClient />;
}
