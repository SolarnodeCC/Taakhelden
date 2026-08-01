import { setRequestLocale } from "next-intl/server";
import GoedkeurenClient from "./GoedkeurenClient";
import ProposalQueue from "./ProposalQueue";

export default async function GoedkeurenPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <div className="max-w-2xl">
      <GoedkeurenClient />
      <ProposalQueue />
    </div>
  );
}
