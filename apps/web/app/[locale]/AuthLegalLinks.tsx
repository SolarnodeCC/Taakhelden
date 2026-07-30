import { getTranslations } from "next-intl/server";
import { Link } from "../../i18n/navigation";

/** Compact privacy/terms links for public auth pages. */
export default async function AuthLegalLinks() {
  const t = await getTranslations("legal.links");

  return (
    <p className="mt-8 text-center text-xs text-muted">
      <Link href="/privacy" className="font-medium text-accent hover:underline">
        {t("privacy")}
      </Link>
      <span aria-hidden="true"> · </span>
      <Link href="/voorwaarden" className="font-medium text-accent hover:underline">
        {t("terms")}
      </Link>
    </p>
  );
}
