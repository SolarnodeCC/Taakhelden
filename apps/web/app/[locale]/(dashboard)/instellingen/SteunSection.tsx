"use client";

import { useTranslations } from "next-intl";
import { Link } from "../../../../i18n/navigation";

/** Parent-only steun placeholder — never shown on child surfaces. */
export default function SteunSection() {
  const t = useTranslations("instellingen.steun");

  return (
    <section aria-labelledby="steun-heading" className="flex flex-col gap-3">
      <h2 id="steun-heading" className="text-base font-semibold text-text">
        {t("title")}
      </h2>
      <p className="text-sm text-muted">{t("body")}</p>
      <p className="flex flex-wrap gap-4 text-sm">
        <a href="mailto:steun@wispel.cc" className="font-medium text-accent hover:underline">
          {t("link")}
        </a>
        <Link href="/steun" className="font-medium text-accent hover:underline">
          {t("pageLink")}
        </Link>
      </p>
    </section>
  );
}
