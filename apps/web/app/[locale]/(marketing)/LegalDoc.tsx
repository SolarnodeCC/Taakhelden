import { getTranslations } from "next-intl/server";
import { Link } from "../../../i18n/navigation";

type LegalSection = { heading: string; body: string };

type LegalDocProps = {
  /** Message namespace under `legal`, e.g. `privacy` or `terms`. */
  namespace: "privacy" | "terms";
};

/**
 * Renders a plain-language legal document from `legal.{namespace}` messages.
 */
export default async function LegalDoc({ namespace }: LegalDocProps) {
  const t = await getTranslations(`legal.${namespace}`);
  const links = await getTranslations("legal");
  const sections = t.raw("sections") as LegalSection[];

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-semibold text-text">{t("title")}</h1>
      <p className="mt-2 text-sm text-muted">{t("updated")}</p>
      <p className="mt-6 text-sm leading-relaxed text-text">{t("intro")}</p>

      <div className="mt-10 flex flex-col gap-8">
        {sections.map((section) => (
          <section key={section.heading}>
            <h2 className="text-base font-semibold text-text">{section.heading}</h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted">
              {section.body}
            </p>
          </section>
        ))}
      </div>

      <p className="mt-12 flex flex-wrap gap-4 text-sm text-muted">
        <Link href="/" className="font-medium text-accent hover:underline">
          {links("backHome")}
        </Link>
        <Link href="/login" className="font-medium text-accent hover:underline">
          {links("backToLogin")}
        </Link>
      </p>
    </main>
  );
}
