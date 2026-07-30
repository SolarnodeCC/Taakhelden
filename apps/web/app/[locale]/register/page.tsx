import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "../../../i18n/navigation";
import { isAuthenticated } from "../../../lib/auth/session";
import AuthLegalLinks from "../AuthLegalLinks";
import RegisterForm from "./RegisterForm";

export default async function RegisterPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (await isAuthenticated()) {
    redirect({ href: "/", locale });
  }

  setRequestLocale(locale);
  const t = await getTranslations("auth");

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6 py-16">
      <h1 className="text-2xl font-semibold text-accent">Wispel</h1>
      <p className="mt-1 text-sm text-muted">{t("register.intro")}</p>
      <RegisterForm />
      <AuthLegalLinks />
    </main>
  );
}
