import { setRequestLocale } from "next-intl/server";
import InzichtenClient from "./InzichtenClient";

export default async function InzichtenPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <InzichtenClient locale={locale} />;
}
