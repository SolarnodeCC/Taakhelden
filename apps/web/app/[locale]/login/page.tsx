import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { redirect } from "../../../i18n/navigation";
import { isAuthenticated } from "../../../lib/auth/session";
import LoginForm from "./LoginForm";

export default function LoginPage({ params }: { params: { locale: string } }) {
  // Already signed in? Skip the form and go straight to the dashboard.
  if (isAuthenticated()) {
    redirect({ href: "/", locale: params.locale });
  }

  setRequestLocale(params.locale);
  const t = useTranslations("auth");

  return (
    <main style={{ fontFamily: "system-ui", padding: "4rem", maxWidth: 420 }}>
      <h1>TaakHelden</h1>
      <p style={{ color: "#555" }}>{t("loginIntro")}</p>
      <LoginForm />
    </main>
  );
}
