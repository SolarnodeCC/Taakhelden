import { setRequestLocale } from "next-intl/server";
import GoedkeurenClient from "./GoedkeurenClient";

export default function GoedkeurenPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  return <GoedkeurenClient />;
}
