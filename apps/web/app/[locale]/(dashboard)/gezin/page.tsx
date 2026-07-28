import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import GezinClient from "./GezinClient";

export default async function GezinPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <Suspense fallback={<p className="text-sm text-muted">…</p>}>
      <GezinClient />
    </Suspense>
  );
}
