import { redirect } from "../../../i18n/navigation";

// The dashboard root lands on the default section.
export default function DashboardIndex({ params }: { params: { locale: string } }) {
  redirect({ href: "/vandaag", locale: params.locale });
}
