import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin(); // defaults to ./i18n/request.ts

/**
 * Security headers for the parent dashboard (child/family data).
 * CSP allows Cloudflare Turnstile + WebSocket to the API host; signed photo
 * URLs may be absolute https on the API origin so img-src includes https:.
 */
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https: wss:",
      "frame-src https://challenges.cloudflare.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
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
