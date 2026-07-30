import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link, redirect } from "../../../i18n/navigation";
import { isAuthenticated } from "../../../lib/auth/session";
import AuthShell from "../AuthShell";
import LoginForm from "./LoginForm";

export default async function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (await isAuthenticated()) {
    redirect({ href: "/vandaag", locale });
  }

  setRequestLocale(locale);
  const t = await getTranslations("auth");

  return (
    <AuthShell promiseKey="login">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
      <p className="mt-6 text-center text-sm text-muted">
        {t("noAccount")}{" "}
        <Link href="/register" className="font-medium text-accent hover:underline">
          {t("registerLink")}
        </Link>
      </p>
    </AuthShell>
  );
}
