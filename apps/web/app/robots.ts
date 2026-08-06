import type { MetadataRoute } from "next";

/**
 * Marketing and dashboard routes ship from the same Next app (build plan O8),
 * so this is the one place that draws the crawl line between them: index the
 * public marketing/legal pages, keep every account-gated and auth-token page
 * out of search and out of AI answer engines (WS-AI-WEBPOLICY).
 */
export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env["NEXT_PUBLIC_SITE_URL"] ?? "https://wispel.cc";

  const disallow = [
    "/api/",
    // Dashboard route group — family data, auth-gated, nothing to index.
    "/*/vandaag",
    "/*/gezin",
    "/*/goedkeuren",
    "/*/instellingen",
    "/*/inzichten",
    "/*/taken",
    "/*/winkel",
    // Auth/account flows — no indexable content, some carry one-time tokens.
    "/*/login",
    "/*/register",
    "/*/uitnodiging",
    "/*/wachtwoord-reset",
    "/*/wachtwoord-vergeten",
  ];

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow,
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
