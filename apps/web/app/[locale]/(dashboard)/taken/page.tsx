import { setRequestLocale } from "next-intl/server";
import TakenClient from "./TakenClient";

export default function TakenPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  return <TakenClient />;
}
