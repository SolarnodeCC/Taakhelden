import { setRequestLocale } from "next-intl/server";
import SectionStub from "../SectionStub";

export default async function InzichtenPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <SectionStub sectionKey="inzichten" />;
}
