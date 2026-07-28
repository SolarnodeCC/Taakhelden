import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin(); // defaults to ./i18n/request.ts

/** @type {import('next').NextConfig} */
export default withNextIntl({
  // @taakhelden/shared ships raw .ts source, so Next must transpile it.
  transpilePackages: ["@taakhelden/shared"],
  // ESLint 10 runs explicitly in CI; Next 15's built-in runner does not support
  // the flat config reliably and would duplicate the same checks during builds.
  eslint: { ignoreDuringBuilds: true },
  env: { NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787/v1" },
});
