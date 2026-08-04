import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin(); // defaults to ./i18n/request.ts

/**
 * Static security headers for the parent dashboard (child/family data).
 *
 * The CSP is NOT here: it carries a per-request nonce so Next's inline
 * bootstrap scripts can run without `script-src 'unsafe-inline'`, which a
 * static header cannot express. See `middleware.ts`.
 */
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  // Cloudflare kan HSTS ook op zone-niveau zetten; hier expliciet zodat de
  // garantie bij de app hoort en niet bij een dashboard-instelling.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

/** @type {import('next').NextConfig} */
export default withNextIntl({
  // @taakhelden/shared ships raw .ts source, so Next must transpile it.
  transpilePackages: ["@taakhelden/shared"],
  // ESLint 10 runs explicitly in CI; Next 15's built-in runner does not support
  // the flat config reliably and would duplicate the same checks during builds.
  eslint: { ignoreDuringBuilds: true },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
});
