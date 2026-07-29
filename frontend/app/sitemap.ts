import type { MetadataRoute } from "next";
import { getAllLibraryItems, librarySlug } from "@/lib/library";
import { SITE_URL } from "@/lib/seo";
import { SURAHS } from "@/lib/surah-meta";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/quran`, lastModified, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_URL}/duas`, lastModified, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_URL}/hadith`, lastModified, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_URL}/hadith-of-day`, lastModified, changeFrequency: "daily", priority: 0.7 },
    { url: `${SITE_URL}/khutba`, lastModified, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE_URL}/learn-quran`, lastModified, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_URL}/library`, lastModified, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_URL}/recite`, lastModified, changeFrequency: "monthly", priority: 0.6 },
  ];

  const surahRoutes: MetadataRoute.Sitemap = SURAHS.map((s) => ({
    url: `${SITE_URL}/quran/${s.number}`,
    lastModified,
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  const libraryItems = await getAllLibraryItems();
  const libraryRoutes: MetadataRoute.Sitemap = libraryItems.map((item) => ({
    url: `${SITE_URL}/library/${librarySlug(item)}`,
    lastModified,
    changeFrequency: "yearly",
    priority: item.curated ? 0.6 : 0.5,
  }));

  return [...staticRoutes, ...surahRoutes, ...libraryRoutes];
}
