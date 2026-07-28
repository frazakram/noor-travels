import { SectionJsonLd } from "@/components/SectionJsonLd";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Daily Duas & Travel Duas with Arabic, Transliteration and Meaning",
  description:
    "Authentic duas (supplications) for travel, morning and evening, eating, sleeping and more — with Arabic text, transliteration, and translations in English, Urdu and Hindi.",
  path: "/duas",
});

export default function DuasLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SectionJsonLd
        name="Daily Duas & Travel Duas"
        description="Authentic duas with Arabic text, transliteration and translations in English, Urdu and Hindi."
        path="/duas"
      />
      {children}
    </>
  );
}
