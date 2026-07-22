import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import LoginForm from "./LoginForm";

export default function LoginPage({ params }: { params: { locale: string } }) {
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
