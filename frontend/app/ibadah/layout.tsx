import { SectionJsonLd } from "@/components/SectionJsonLd";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Ibadah Guide — How to Perform Wudu, Salah & More (Hanafi)",
  description:
    "Step-by-step guides to wudu, prayer and other acts of worship with Quran and Sahih al-Bukhari references, in English, Urdu and Hindi. Following the Hanafi school.",
  path: "/ibadah",
});

export default function IbadahLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SectionJsonLd
        name="Ibadah Guide"
        description="Step-by-step guides to acts of worship with Quran and hadith references."
        path="/ibadah"
      />
      {children}
    </>
  );
}
