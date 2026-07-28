import type { Metadata } from "next";
import { Suspense } from "react";
import { JsonLd } from "@/components/JsonLd";
import { pageMetadata, SITE_URL } from "@/lib/seo";
import { getSurahMeta, SURAHS } from "@/lib/surah-meta";
import SurahClient from "./SurahClient";

type Props = { params: Promise<{ surah: string }> };

export function generateStaticParams() {
  return SURAHS.map((s) => ({ surah: String(s.number) }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { surah } = await params;
  const meta = getSurahMeta(Number(surah));
  if (!meta) {
    return { title: "Surah not found", robots: { index: false, follow: false } };
  }
  return pageMetadata({
    title: `Surah ${meta.name} (${meta.english}) — Read Online with Translation`,
    description: `Read Surah ${meta.name} (chapter ${meta.number} of the Quran, "${meta.english}", ${meta.ayahs} ayahs) with Arabic text, English, Urdu and Hindi translation, audio recitation and tafsir.`,
    path: `/quran/${meta.number}`,
  });
}

export default async function SurahPage({ params }: Props) {
  const { surah } = await params;
  const meta = getSurahMeta(Number(surah));

  return (
    <>
      {meta && (
        <JsonLd
          data={[
            {
              "@context": "https://schema.org",
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
                { "@type": "ListItem", position: 2, name: "Quran", item: `${SITE_URL}/quran` },
                {
                  "@type": "ListItem",
                  position: 3,
                  name: `Surah ${meta.name}`,
                  item: `${SITE_URL}/quran/${meta.number}`,
                },
              ],
            },
            {
              "@context": "https://schema.org",
              "@type": "WebPage",
              name: `Surah ${meta.name} (${meta.english})`,
              url: `${SITE_URL}/quran/${meta.number}`,
              isPartOf: { "@id": `${SITE_URL}/#website` },
              about: {
                "@type": "Book",
                name: "The Quran",
                inLanguage: "ar",
              },
              position: meta.number,
            },
          ]}
        />
      )}
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <SurahClient />
      </Suspense>
    </>
  );
}
