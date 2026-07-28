import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import InstellingenClient from "./InstellingenClient";

export default async function InstellingenPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <Suspense fallback={<p className="text-sm text-muted">…</p>}>
      <InstellingenClient />
    </Suspense>
  );
}
