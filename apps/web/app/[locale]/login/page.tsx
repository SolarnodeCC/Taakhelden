import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "../../../i18n/navigation";
import { isAuthenticated } from "../../../lib/auth/session";
import LoginForm from "./LoginForm";

export default async function LoginPage({ params }: { params: { locale: string } }) {
  // Already signed in? Skip the form and go straight to the dashboard.
  if (await isAuthenticated()) {
    redirect({ href: "/", locale: params.locale });
  }

  setRequestLocale(params.locale);
  const t = await getTranslations("auth");

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6 py-16">
      <h1 className="text-2xl font-semibold text-accent">TaakHelden</h1>
      <p className="mt-1 text-sm text-muted">{t("loginIntro")}</p>
      <LoginForm />
    </main>
  );
}
