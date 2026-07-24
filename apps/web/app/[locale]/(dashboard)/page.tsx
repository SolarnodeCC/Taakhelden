import { redirect } from "../../../i18n/navigation";

// The dashboard root lands on the default section.
export default async function DashboardIndex({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect({ href: "/vandaag", locale });
}
