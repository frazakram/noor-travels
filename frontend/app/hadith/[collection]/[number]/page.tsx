import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HadithDetail, type HadithRecord } from "@/components/HadithDetail";
import { pageMetadata, SITE_URL } from "@/lib/seo";

type Props = { params: Promise<{ collection: string; number: string }> };

const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL || SITE_URL;

/** "missing" only on a definite 404; a network failure returns null and the page loads client-side. */
async function loadHadith(collection: string, number: string): Promise<HadithRecord | "missing" | null> {
  if (!/^[a-z]+$/.test(collection) || !/^\d{1,6}$/.test(number)) return "missing";
  try {
    const res = await fetch(`${API_ORIGIN}/api/hadith/${collection}/${Number(number)}`, {
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.status === 404) return "missing";
    if (!res.ok) return null;
    return (await res.json()) as HadithRecord;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { collection, number } = await params;
  const hadith = await loadHadith(collection, number);
  if (hadith === "missing") return { title: "Hadith not found", robots: { index: false, follow: false } };
  const title = hadith ? `${hadith.reference} — ${hadith.chapter_en}` : `Hadith ${number}`;
  return pageMetadata({
    title,
    description: hadith ? hadith.english.replace(/\s+/g, " ").slice(0, 155) : "Hadith from Sahih al-Bukhari in Arabic and English.",
    path: `/hadith/${collection}/${number}`,
  });
}

export default async function HadithByNumberPage({ params }: Props) {
  const { collection, number } = await params;
  const hadith = await loadHadith(collection, number);
  if (hadith === "missing") notFound();
  return <HadithDetail collection={collection} number={Number(number)} initial={hadith} />;
}
