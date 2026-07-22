import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin(); // defaults to ./i18n/request.ts

/** @type {import('next').NextConfig} */
export default withNextIntl({
  // @taakhelden/shared ships raw .ts source, so Next must transpile it.
  transpilePackages: ["@taakhelden/shared"],
  env: { NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787/v1" },
});
