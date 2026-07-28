import { SectionJsonLd } from "@/components/SectionJsonLd";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Islamic Q&A Library — 6,000+ Answered Questions with Sources",
  description:
    "Search over 6,000 answered questions about Islam — faith, salah, misconceptions, science, new Muslims, daily life — every answer cited to the Quran and authentic hadith.",
  path: "/library",
});

export default function LibraryLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SectionJsonLd
        name="Islamic Q&A Library"
        description="Over 6,000 answered questions about Islam, every answer cited to the Quran and authentic hadith."
        path="/library"
      />
      {children}
    </>
  );
}
