import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { ShareButton } from "@/components/ShareButton";
import {
  getHadithForDate,
  isValidDateString,
  shiftDateString,
  todayDateString,
} from "@/lib/hadith-of-day";
import { SITE_NAME, SITE_URL } from "@/lib/seo";

export const dynamicParams = true;

type Props = { params: Promise<{ date: string }> };

function formatDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-IN", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { date } = await params;
  if (!isValidDateString(date) || date > todayDateString()) {
    return { title: "Hadith of the Day not found", robots: { index: false, follow: false } };
  }
  const hadith = await getHadithForDate(date);
  if (!hadith) {
    return { title: "Hadith of the Day not found", robots: { index: false, follow: false } };
  }
  const title = `Hadith of the Day — ${formatDate(date)}`;
  const description = `${truncate(hadith.english, 130)} — ${hadith.reference}`;

  return {
    title,
    description,
    alternates: { canonical: `/hadith-of-day/${date}` },
    openGraph: {
      title: `${title} · ${SITE_NAME}`,
      description,
      url: `/hadith-of-day/${date}`,
      siteName: SITE_NAME,
      type: "article",
      locale: "en_IN",
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} · ${SITE_NAME}`,
      description,
    },
  };
}

export default async function HadithOfDayDatePage({ params }: Props) {
  const { date } = await params;
  if (!isValidDateString(date) || date > todayDateString()) notFound();

  const hadith = await getHadithForDate(date);
  if (!hadith) notFound();

  const pageUrl = `${SITE_URL}/hadith-of-day/${date}`;
  const prevDate = shiftDateString(date, -1);
  const nextDate = shiftDateString(date, 1);
  const hasNext = nextDate <= todayDateString();

  return (
    <article className="mx-auto max-w-2xl space-y-5 pb-8">
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "Quotation",
            text: hadith.english,
            citation: hadith.reference,
            inLanguage: "en",
            about: { "@type": "Thing", name: "Hadith" },
            datePublished: date,
            url: pageUrl,
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
              {
                "@type": "ListItem",
                position: 2,
                name: "Hadith of the Day",
                item: `${SITE_URL}/hadith-of-day`,
              },
              { "@type": "ListItem", position: 3, name: formatDate(date), item: pageUrl },
            ],
          },
        ]}
      />

      <nav aria-label="Breadcrumb" className="text-xs text-faint">
        <Link href="/hadith-of-day" className="hover:underline">
          Hadith of the Day
        </Link>
      </nav>

      <header>
        <p className="text-xs font-semibold uppercase tracking-widest text-amber-600 dark:text-amber-400">
          {formatDate(date)}
        </p>
        {hadith.chapter_en && <h1 className="mt-1 text-xl font-bold text-heading">{hadith.chapter_en}</h1>}
      </header>

      <section className="card space-y-4 border-gold-200/70 dark:border-gold-500/25">
        <div className="flex justify-end">
          <ShareButton
            lang="en"
            payload={{
              title: hadith.reference,
              text: `${hadith.english}\n\n— ${hadith.reference}\n${pageUrl}`,
            }}
            tipSide="top"
          />
        </div>
        <p
          className="font-arabic text-right text-lg leading-loose text-slate-800 dark:text-white sm:text-xl"
          dir="rtl"
        >
          {hadith.arabic}
        </p>
        <p className="whitespace-pre-line text-sm leading-relaxed text-body">{hadith.english}</p>
        <p className="text-xs font-medium text-amber-600 dark:text-amber-400">{hadith.reference}</p>
      </section>

      <nav aria-label="More days" className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <Link href={`/hadith-of-day/${prevDate}`} className="text-accent hover:underline">
          ← {formatDate(prevDate)}
        </Link>
        {hasNext && (
          <Link href={`/hadith-of-day/${nextDate}`} className="text-accent hover:underline">
            {formatDate(nextDate)} →
          </Link>
        )}
      </nav>

      <div className="flex flex-wrap gap-4 border-t border-subtle pt-4 text-sm">
        <Link href="/hadith-of-day" className="text-accent hover:underline">
          Today&apos;s hadith →
        </Link>
        <Link href="/hadith" className="text-accent hover:underline">
          Browse all Hadith →
        </Link>
      </div>
    </article>
  );
}
