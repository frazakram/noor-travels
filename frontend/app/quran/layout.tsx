import type { Metadata } from "next";
import { SectionJsonLd } from "@/components/SectionJsonLd";
import { pageMetadata, SITE_NAME } from "@/lib/seo";

export const metadata: Metadata = {
  ...pageMetadata({
    title: "Read the Quran Online — All 114 Surahs with Translation",
    description:
      "Read the complete Quran online with English, Urdu and Hindi translations, word-by-word audio recitation, tafsir, and memorisation (hifz) tools. All 114 surahs, free.",
    path: "/quran",
  }),
  // A plain-string title here would break the root template chain for child
  // segments — re-declare it so /quran/[surah] titles keep the site suffix.
  title: {
    default: "Read the Quran Online — All 114 Surahs with Translation",
    template: `%s · ${SITE_NAME}`,
  },
};

export default function QuranLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SectionJsonLd
        name="Read the Quran Online"
        description="All 114 surahs with English, Urdu and Hindi translations, audio recitation and tafsir."
        path="/quran"
      />
      {children}
    </>
  );
}
