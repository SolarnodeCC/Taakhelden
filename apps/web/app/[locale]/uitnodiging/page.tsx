import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import AcceptForm from "./AcceptForm";

/**
 * Public invite-accept page (outside dashboard layout). Does NOT redirect when
 * already signed in — accepting overwrites the existing session cookies.
 */
export default async function UitnodigingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("auth.accept");

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6 py-16">
      <h1 className="text-2xl font-semibold text-accent">TaakHelden</h1>
      <p className="mt-1 text-sm text-muted">{t("intro")}</p>
      <Suspense fallback={<p className="mt-6 text-sm text-muted">{t("loading")}</p>}>
        <AcceptForm />
      </Suspense>
    </main>
  );
}
