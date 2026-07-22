import { useTranslations } from "next-intl";

// Placeholder body for a dashboard section whose real content lands in a later
// batch. Title/body come from the `sections` message namespace.
export default function SectionStub({ sectionKey }: { sectionKey: string }) {
  const t = useTranslations("sections");
  return (
    <section className="max-w-2xl">
      <h1 className="text-xl font-semibold text-text">{t(`${sectionKey}.title`)}</h1>
      <p className="mt-2 text-sm text-muted">{t(`${sectionKey}.body`)}</p>
    </section>
  );
}
