import { setRequestLocale } from "next-intl/server";
import GoedkeurenClient from "./GoedkeurenClient";

export default async function GoedkeurenPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <GoedkeurenClient />;
}
