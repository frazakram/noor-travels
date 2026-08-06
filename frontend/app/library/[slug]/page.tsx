import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { ShareButton } from "@/components/ShareButton";
import {
  getCuratedLibraryItems,
  getLibraryItem,
  getRelatedLibraryItems,
  librarySlug,
} from "@/lib/library";
import { categoryBrowsePath, categoryLabel, browsePathLabel } from "@/lib/library-categories";
import { SITE_NAME, SITE_URL } from "@/lib/seo";

export const dynamicParams = true;

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  const curated = await getCuratedLibraryItems();
  return curated.map((item) => ({ slug: librarySlug(item) }));
}

function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const result = await getLibraryItem(slug);
  if (!result) {
    return { title: "Question not found", robots: { index: false, follow: false } };
  }
  const { item, answer } = result;
  const canonicalSlug = librarySlug(item);
  const title = truncate(item.question, 65);
  const description = truncate(answer.answer, 155);

  return {
    title,
    description,
    alternates: { canonical: `/library/${canonicalSlug}` },
    openGraph: {
      title: `${title} · ${SITE_NAME}`,
      description,
      url: `/library/${canonicalSlug}`,
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

export default async function LibraryQuestionPage({ params }: Props) {
  const { slug } = await params;
  const result = await getLibraryItem(slug);
  if (!result) notFound();

  const { item, answer } = result;
  const canonicalSlug = librarySlug(item);
  if (slug !== canonicalSlug) {
    redirect(`/library/${canonicalSlug}`);
  }

  const related = await getRelatedLibraryItems(item);
  const pageUrl = `${SITE_URL}/library/${canonicalSlug}`;

  return (
    <article className="mx-auto max-w-2xl space-y-5 pb-8">
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "QAPage",
            mainEntity: {
              "@type": "Question",
              name: item.question,
              text: item.question,
              answerCount: 1,
              acceptedAnswer: {
                "@type": "Answer",
                text: answer.answer,
                url: pageUrl,
              },
            },
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
              { "@type": "ListItem", position: 2, name: "Library", item: `${SITE_URL}/library` },
              { "@type": "ListItem", position: 3, name: truncate(item.question, 60), item: pageUrl },
            ],
          },
        ]}
      />

      <nav aria-label="Breadcrumb" className="text-xs text-faint">
        <Link href="/library" className="hover:underline">
          Library
        </Link>
        {" › "}
        <Link href={`/library?category=${item.category}`} className="hover:underline">
          {categoryLabel("en", item.category)}
        </Link>
      </nav>

      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-heading">{item.question}</h1>
          <p className="mt-1 text-[10px] uppercase tracking-wide text-faint">
            {categoryLabel("en", item.category)}
          </p>
        </div>
        <ShareButton
          lang="en"
          payload={{
            title: item.question,
            text: `${item.question}\n\n${truncate(answer.answer, 400)}\n\n${pageUrl}`,
          }}
          tipSide="top"
          className="shrink-0"
        />
      </header>

      <section
        aria-labelledby="answer-heading"
        className="rounded-xl border border-teal-200 bg-teal-50/50 p-4 dark:border-teal-800 dark:bg-teal-950/20"
      >
        <h2 id="answer-heading" className="sr-only">
          Answer
        </h2>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-body">{answer.answer}</p>
        {answer.citations.length > 0 && (
          <p className="mt-3 text-xs text-accent">Citations: {answer.citations.join(" · ")}</p>
        )}
      </section>

      {answer.sources.length > 0 && (
        <section aria-labelledby="sources-heading">
          <h2 id="sources-heading" className="text-sm font-semibold text-heading">
            Sources
          </h2>
          <ul className="mt-2 space-y-2">
            {answer.sources.map((s, i) => (
              <li key={i} className="rounded-lg border border-subtle bg-surface-muted/50 p-2 text-xs">
                <p className="font-medium text-heading">{s.ref}</p>
                <p className="mt-1 text-muted">{s.snippet}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {related.length > 0 && (
        <nav aria-labelledby="related-heading">
          <h2 id="related-heading" className="text-sm font-semibold text-heading">
            Related questions
          </h2>
          <ul className="mt-2 space-y-1.5">
            {related.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/library/${librarySlug(r)}`}
                  className="text-sm text-accent hover:underline"
                >
                  {r.question}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {categoryBrowsePath(item.category) && (
        <p className="text-sm">
          <Link href={categoryBrowsePath(item.category)!} className="text-accent hover:underline">
            {browsePathLabel(categoryBrowsePath(item.category)!)} →
          </Link>
        </p>
      )}

      <p className="text-[10px] text-faint">
        This answer was prepared offline from verified sources — not a live chat request.
      </p>
    </article>
  );
}
