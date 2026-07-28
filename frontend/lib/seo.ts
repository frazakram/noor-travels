import type { Metadata } from "next";

/** Canonical origin for absolute URLs (sitemap, OG, canonical). */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://noor-travels-chi.vercel.app";

export const SITE_NAME = "Noor Safar";

export const DEFAULT_DESCRIPTION =
  "Read the Quran with translations, browse authentic Hadith, learn daily duas, get precise prayer times for your city, and follow live khutba translation — free, in English, Urdu and Hindi.";

type PageMetaInput = {
  title: string;
  description: string;
  /** Route path starting with "/" — becomes the canonical URL. */
  path: string;
  noIndex?: boolean;
};

/**
 * Build the full Metadata object for a page: title, description, canonical,
 * robots, Open Graph and Twitter card. Root layout supplies metadataBase and
 * the title template.
 */
export function pageMetadata({ title, description, path, noIndex }: PageMetaInput): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    ...(noIndex ? { robots: { index: false, follow: false } } : {}),
    openGraph: {
      title: `${title} · ${SITE_NAME}`,
      description,
      url: path,
      siteName: SITE_NAME,
      type: "website",
      locale: "en_IN",
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} · ${SITE_NAME}`,
      description,
    },
  };
}
