import { setRequestLocale } from "next-intl/server";
import TakenClient from "./TakenClient";

export default async function TakenPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <TakenClient />;
}
