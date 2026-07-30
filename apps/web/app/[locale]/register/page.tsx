import { setRequestLocale } from "next-intl/server";
import { redirect } from "../../../i18n/navigation";
import { isAuthenticated } from "../../../lib/auth/session";
import AuthShell from "../AuthShell";
import RegisterForm from "./RegisterForm";

export default async function RegisterPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (await isAuthenticated()) {
    redirect({ href: "/vandaag", locale });
  }

  setRequestLocale(locale);

  return (
    <AuthShell promiseKey="register">
      <RegisterForm />
    </AuthShell>
  );
}
