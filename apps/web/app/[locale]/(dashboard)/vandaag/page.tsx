import { setRequestLocale } from "next-intl/server";
import VandaagClient from "./VandaagClient";

export default async function VandaagPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <VandaagClient />;
}
