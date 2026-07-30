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
    <nav className="flex gap-1" aria-label="Language">
      {routing.locales.map((locale) => (
        <button
          key={locale}
          type="button"
          disabled={locale === active}
          aria-current={locale === active ? "true" : undefined}
          aria-label={locale === "nl" ? "Nederlands" : "English"}
          onClick={() => router.replace(pathname, { locale })}
          className={
            "rounded px-2 py-1 text-xs font-medium transition-colors " +
            (locale === active
              ? "bg-accent text-accent-fg"
              : "text-muted hover:bg-border/50")
          }
        >
          {locale.toUpperCase()}
        </button>
      ))}
    </nav>
  );
}
