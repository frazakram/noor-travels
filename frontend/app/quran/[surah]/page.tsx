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
      {meta && related.length > 0 && (
        // A collapsed <details> keeps this compact and out of the way of the
        // reader below it. Placed above SurahClient (not after) on purpose:
        // SurahClient loads its ayahs client-side and grows substantially
        // after first paint, so anything sitting below it inherits a large
        // layout-shift score once that content lands.
        <details className="mx-auto mb-3 max-w-2xl rounded-lg border border-subtle px-3 py-2 text-sm">
          <summary className="cursor-pointer font-medium text-heading">
            Questions about Surah {meta.name}
          </summary>
          <nav aria-label={`Questions about Surah ${meta.name}`}>
            <ul className="mt-2 space-y-1.5">
              {related.map((item) => (
                <li key={item.id}>
                  <Link href={`/library/${librarySlug(item)}`} className="text-accent hover:underline">
                    {item.question}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </details>
      )}
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <SurahClient />
      </Suspense>
    </>
  );
}
