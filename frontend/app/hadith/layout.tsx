import { SectionJsonLd } from "@/components/SectionJsonLd";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Hadith Browser — Sahih Bukhari, Muslim and More by Topic",
  description:
    "Browse authentic hadith from Sahih al-Bukhari, Sahih Muslim and other collections, organised by topic, with translations in English, Urdu and Hindi.",
  path: "/hadith",
});

export default function HadithLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SectionJsonLd
        name="Hadith Browser"
        description="Authentic hadith from Sahih al-Bukhari, Sahih Muslim and other collections, organised by topic."
        path="/hadith"
      />
      {children}
    </>
  );
}
