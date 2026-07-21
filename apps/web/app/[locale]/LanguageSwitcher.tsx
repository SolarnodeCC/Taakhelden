"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "../../i18n/navigation";
import { routing } from "../../i18n/routing";

// Minimal locale switcher — plain buttons, no component library yet.
export default function LanguageSwitcher() {
  const active = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <nav style={{ display: "flex", gap: "0.5rem", marginTop: "1.5rem" }}>
      {routing.locales.map((locale) => (
        <button
          key={locale}
          type="button"
          disabled={locale === active}
          onClick={() => router.replace(pathname, { locale })}
        >
          {locale.toUpperCase()}
        </button>
      ))}
    </nav>
  );
}
