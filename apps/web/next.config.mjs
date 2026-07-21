import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin(); // defaults to ./i18n/request.ts

/** @type {import('next').NextConfig} */
export default withNextIntl({
  env: { NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787/v1" },
});
