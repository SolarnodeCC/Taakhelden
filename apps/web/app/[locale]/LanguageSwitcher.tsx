"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "../../i18n/navigation";
import { routing } from "../../i18n/routing";

// Locale switcher. The active locale is marked with `aria-current` and is a
// no-op click — `disabled` would drop it out of the tab order, and pairing it
// with the filled accent treatment made the *current* state look like the
// recommended action.
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
          aria-current={locale === active ? "true" : undefined}
          aria-label={locale === "nl" ? "Nederlands" : "English"}
          onClick={() => {
            if (locale !== active) router.replace(pathname, { locale });
          }}
          className={
            "inline-flex min-h-11 items-center rounded px-2 py-1 text-xs font-medium transition-colors " +
            (locale === active
              ? "bg-surface font-semibold text-text"
              : "text-muted hover:bg-border/50")
          }
        >
          {locale.toUpperCase()}
        </button>
      ))}
    </nav>
  );
}
