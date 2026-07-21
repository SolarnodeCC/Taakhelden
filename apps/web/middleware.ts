import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// Handles `/` -> `/nl` redirect and Accept-Language negotiation.
export default createMiddleware(routing);

export const config = {
  // Match all paths except API routes, Next internals, and files with an extension.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
