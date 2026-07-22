import { redirect } from "../../../i18n/navigation";
import { isAuthenticated } from "../../../lib/auth/session";

/**
 * Protects everything in the (dashboard) group: unauthenticated visitors are
 * sent to the localized login screen. Reading cookies makes these routes render
 * dynamically, which is correct for an authenticated area.
 */
export default function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  if (!isAuthenticated()) {
    redirect({ href: "/login", locale: params.locale });
  }

  return <>{children}</>;
}
