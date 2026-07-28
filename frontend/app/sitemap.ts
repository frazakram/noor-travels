import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";
import { SURAHS } from "@/lib/surah-meta";

export default function sitemap(): MetadataRoute.Sitemap {
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

  return [...staticRoutes, ...surahRoutes];
}
