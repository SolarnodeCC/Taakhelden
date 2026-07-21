import { defineRouting } from "next-intl/routing";

// NL is the primary locale, EN is added for reach ("NL eerst, EN erbij").
export const routing = defineRouting({
  locales: ["nl", "en"],
  defaultLocale: "nl",
});
