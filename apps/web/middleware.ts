import createMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import { buildCsp } from "./lib/csp";

// Handles `/` -> `/nl` redirect and Accept-Language negotiation.
const intlMiddleware = createMiddleware(routing);

export default function middleware(request: NextRequest): ReturnType<typeof intlMiddleware> {
  const nonce = crypto.randomUUID().replaceAll("-", "");
  const csp = buildCsp(nonce);

  // Next leest de nonce uit deze request-header en zet hem op zijn eigen inline
  // scripts. `x-nonce` staat er voor componenten die zelf een tag willen zetten.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);

  const response = intlMiddleware(
    new Request(request, { headers: requestHeaders }) as NextRequest,
  );
  response.headers.set("content-security-policy", csp);
  return response;
}

export const config = {
  // Match all paths except API routes, Next internals, and files with an extension.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
