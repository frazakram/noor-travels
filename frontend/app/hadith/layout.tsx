import { SectionJsonLd } from "@/components/SectionJsonLd";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Hadith & Duas — Sahih al-Bukhari by Topic",
  description:
    "Browse all 7,277 hadith of Sahih al-Bukhari in Arabic and English, organised by topic, plus daily duas with sources — search, save favourites and read the hadith of the day.",
  path: "/hadith",
});

export default function HadithLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SectionJsonLd
        name="Hadith & Duas"
        description="All 7,277 hadith of Sahih al-Bukhari in Arabic and English, organised by topic, plus daily duas."
        path="/hadith"
      />
      {children}
    </>
  );
}
