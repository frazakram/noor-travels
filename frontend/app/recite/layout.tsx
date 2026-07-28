import { SectionJsonLd } from "@/components/SectionJsonLd";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Recitation Practice — Get Word-by-Word Feedback",
  description:
    "Practise reciting the Quran and get instant word-level feedback: recite an ayah, see exactly which words matched, and improve your tajweed and memorisation.",
  path: "/recite",
});

export default function ReciteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SectionJsonLd
        name="Recitation Practice"
        description="Practise Quran recitation with instant word-level feedback."
        path="/recite"
      />
      {children}
    </>
  );
}
