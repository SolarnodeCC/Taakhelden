import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import AuthShell from "../AuthShell";
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
    <AuthShell promiseKey="accept">
      <Suspense fallback={<p className="text-sm text-muted">{t("loading")}</p>}>
        <AcceptForm />
      </Suspense>
    </AuthShell>
  );
}
