import { setRequestLocale } from "next-intl/server";
import WinkelClient from "./WinkelClient";

export default function WinkelPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  return <WinkelClient />;
}
