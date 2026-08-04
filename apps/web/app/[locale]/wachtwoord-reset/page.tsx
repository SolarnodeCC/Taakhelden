import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { Link, redirect } from "../../../i18n/navigation";
import { isAuthenticated } from "../../../lib/auth/session";
import { getTranslations } from "next-intl/server";
import AuthShell from "../AuthShell";
import ResetPasswordForm from "./ResetPasswordForm";

export default async function WachtwoordResetPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (await isAuthenticated()) {
    redirect({ href: "/vandaag", locale });
  }

  setRequestLocale(locale);
  const t = await getTranslations("auth.resetPassword");

  return (
    <AuthShell promiseKey="resetPassword">
      <Suspense fallback={null}>
        <ResetPasswordForm />
      </Suspense>
      <p className="mt-6 text-center text-sm text-muted">
        {t("backToLogin")}{" "}
        <Link href="/login" className="font-medium text-accent hover:underline">
          {t("loginLink")}
        </Link>
      </p>
    </AuthShell>
  );
}
