import { redirect } from "../../../i18n/navigation";
import { isAuthenticated } from "../../../lib/auth/session";
import AppShell from "./AppShell";

/**
 * Protects everything in the (dashboard) group: unauthenticated visitors are
 * sent to the localized login screen. Reading cookies makes these routes render
 * dynamically, which is correct for an authenticated area. Authenticated pages
 * render inside the shared app shell (nav + header).
 */
export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  if (!(await isAuthenticated())) {
    redirect({ href: "/login", locale: params.locale });
  }

  return <AppShell>{children}</AppShell>;
}
