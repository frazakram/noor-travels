import type { Metadata } from "next";
import { SectionJsonLd } from "@/components/SectionJsonLd";
import { pageMetadata, SITE_NAME } from "@/lib/seo";

export const metadata: Metadata = {
  ...pageMetadata({
    title: "Hadith of the Day",
    description:
      "A new authentic hadith every day from Sahih al-Bukhari, Sahih Muslim and other collections, with translation and reference — a daily dose of prophetic guidance.",
    path: "/hadith-of-day",
  }),
  // Re-declare as a template (not a plain string) so /hadith-of-day/[date]
  // titles keep the site suffix — see the same fix on app/quran/layout.tsx.
  title: {
    default: "Hadith of the Day",
    template: `%s · ${SITE_NAME}`,
  },
};

export default function HadithOfDayLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SectionJsonLd
        name="Hadith of the Day"
        description="A new authentic hadith every day with translation and reference."
        path="/hadith-of-day"
      />
      {children}
    </>
  );
}
