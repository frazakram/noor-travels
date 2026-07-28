import { SectionJsonLd } from "@/components/SectionJsonLd";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Hadith of the Day",
  description:
    "A new authentic hadith every day from Sahih al-Bukhari, Sahih Muslim and other collections, with translation and reference — a daily dose of prophetic guidance.",
  path: "/hadith-of-day",
});

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
