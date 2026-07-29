import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { JsonLd } from "@/components/JsonLd";
import { getLibraryItemsByTag, librarySlug } from "@/lib/library";
import { pageMetadata, SITE_URL } from "@/lib/seo";
import { getSurahMeta, SURAHS } from "@/lib/surah-meta";
import { libraryTagForSurah } from "@/lib/surah-library-tags";
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
  const tag = meta ? libraryTagForSurah(meta.number) : undefined;
  const related = tag ? await getLibraryItemsByTag(tag) : [];

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
      {meta && related.length > 0 && (
        <nav aria-labelledby="surah-related-heading" className="mx-auto mt-6 max-w-2xl border-t border-subtle pt-4">
          <h2 id="surah-related-heading" className="text-sm font-semibold text-heading">
            Questions about Surah {meta.name}
          </h2>
          <ul className="mt-2 space-y-1.5">
            {related.map((item) => (
              <li key={item.id}>
                <Link href={`/library/${librarySlug(item)}`} className="text-sm text-accent hover:underline">
                  {item.question}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </>
  );
}
