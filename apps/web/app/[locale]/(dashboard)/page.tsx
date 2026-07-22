import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import LanguageSwitcher from "../LanguageSwitcher";
import LogoutButton from "./LogoutButton";

/**
 * Placeholder — het echte dashboard (Vandaag / Goedkeuren / Taken / Winkel / Inzichten)
 * wordt gebouwd in volgende batches. Deze pagina is nu afgeschermd achter parent-auth.
 */
export default function Home({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  const t = useTranslations("home");

  return (
    <main style={{ fontFamily: "system-ui", padding: "4rem", maxWidth: 640 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>TaakHelden</h1>
        <LogoutButton />
      </div>
      <p>{t("subtitle")}</p>
      <LanguageSwitcher />
    </main>
  );
}
