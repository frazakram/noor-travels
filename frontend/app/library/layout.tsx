import type { Metadata } from "next";
import { SectionJsonLd } from "@/components/SectionJsonLd";
import { pageMetadata, SITE_NAME } from "@/lib/seo";

export const metadata: Metadata = {
  ...pageMetadata({
    title: "Islamic Q&A Library — 6,000+ Answered Questions with Sources",
    description:
      "Search over 6,000 answered questions about Islam — faith, salah, misconceptions, science, new Muslims, daily life — every answer cited to the Quran and authentic hadith.",
    path: "/library",
  }),
  // Re-declare as a template (not a plain string) so /library/[slug] titles
  // keep the site suffix — see the same fix on app/quran/layout.tsx.
  title: {
    default: "Islamic Q&A Library — 6,000+ Answered Questions with Sources",
    template: `%s · ${SITE_NAME}`,
  },
};

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
