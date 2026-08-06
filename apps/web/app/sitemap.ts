import type { MetadataRoute } from "next";
import { routing } from "../i18n/routing";

/** Public marketing/legal pages only — dashboard and auth routes stay unlisted (see robots.ts). */
const PUBLIC_PATHS = ["", "/privacy", "/voorwaarden", "/steun"];

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = process.env["NEXT_PUBLIC_SITE_URL"] ?? "https://wispel.cc";

  return routing.locales.flatMap((locale) =>
    PUBLIC_PATHS.map((path) => ({
      url: `${siteUrl}/${locale}${path}`,
      lastModified: new Date(),
    })),
  );
}
