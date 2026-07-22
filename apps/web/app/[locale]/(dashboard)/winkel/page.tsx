import { setRequestLocale } from "next-intl/server";
import SectionStub from "../SectionStub";

export default function WinkelPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  return <SectionStub sectionKey="winkel" />;
}
