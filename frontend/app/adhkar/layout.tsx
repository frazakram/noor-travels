import { SectionJsonLd } from "@/components/SectionJsonLd";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Adhkar — Morning, Evening & Night Remembrance",
  description:
    "Authentic morning, evening and night adhkar from Hisn al-Muslim, the Quran and Sahih hadith — with Qari recitation for Quran verses, counters, bookmarks and daily progress.",
  path: "/adhkar",
});

export default function AdhkarLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SectionJsonLd
        name="Adhkar"
        description="Morning, evening and night adhkar from Hisn al-Muslim, the Quran and Sahih hadith."
        path="/adhkar"
      />
      {children}
    </>
  );
}
