import { setRequestLocale } from "next-intl/server";
import WinkelClient from "./WinkelClient";

export default async function WinkelPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <WinkelClient />;
}
