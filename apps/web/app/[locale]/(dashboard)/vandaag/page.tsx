import { setRequestLocale } from "next-intl/server";
import SectionStub from "../SectionStub";

export default function VandaagPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  return <SectionStub sectionKey="vandaag" />;
}
