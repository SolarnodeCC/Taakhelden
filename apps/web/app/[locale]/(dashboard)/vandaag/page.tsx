import { setRequestLocale } from "next-intl/server";
import VandaagClient from "./VandaagClient";

export default function VandaagPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  return <VandaagClient />;
}
