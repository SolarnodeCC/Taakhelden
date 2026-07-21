import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import LanguageSwitcher from "./LanguageSwitcher";

/**
 * Placeholder — het echte dashboard (Vandaag / Goedkeuren / Taken / Winkel / Inzichten)
 * wordt gebouwd zodra de API-auth staat. De visuele richting krijgt dan een eigen
 * design-pass (tokens, typografie) conform het productvoorstel §4.
 */
export default function Home({ params }: { params: { locale: string } }) {
  // Enable static rendering for this locale segment.
  setRequestLocale(params.locale);

  const t = useTranslations("home");

  return (
    <main style={{ fontFamily: "system-ui", padding: "4rem", maxWidth: 640 }}>
      <h1>TaakHelden</h1>
      <p>
        {t("subtitle")} API: {process.env.NEXT_PUBLIC_API_URL}
      </p>
      <LanguageSwitcher />
    </main>
  );
}
