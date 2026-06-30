"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { decodeHtmlEntities } from "@/lib/html";

type SermonSummary = {
  slug: string;
  title: string;
  source_url: string;
};

type SermonDetail = SermonSummary & {
  english_text: string;
};

export function FeaturedKhutba() {
  const [sermon, setSermon] = useState<SermonDetail | null>(null);

  useEffect(() => {
    api<{ sermons: SermonSummary[] }>("/api/khutba/sermons")
      .then(async (data) => {
        if (!data.sermons.length) return;
        const index = Math.floor(Date.now() / 86_400_000) % data.sermons.length;
        const picked = data.sermons[index];
        const detail = await api<SermonDetail>(`/api/khutba/sermons/${encodeURIComponent(picked.slug)}`);
        setSermon(detail);
      })
      .catch(() => setSermon(null));
  }, []);

  if (!sermon) return null;

  const title = decodeHtmlEntities(sermon.title);
  const preview = decodeHtmlEntities(sermon.english_text)
    .replace(/\s+/g, " ")
    .slice(0, 220);

  return (
    <section className="card relative overflow-hidden border-gold-100 bg-gradient-to-br from-gold-50 to-white p-4 dark:border-gold-500/30 dark:from-noor-900 dark:to-noor-950 sm:p-5">
      <div className="absolute -right-14 -top-14 h-36 w-36 rounded-full bg-gold-300/20 blur-3xl" />
      <p className="text-xs font-semibold uppercase tracking-wider text-accent">Featured Khutba this Friday</p>
      <h2 className="mt-2 text-lg font-bold text-heading sm:text-xl">{title}</h2>
      <p className="mt-2 max-w-3xl text-xs leading-relaxed text-body sm:text-sm">{preview}…</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link href="/khutba" className="btn-primary px-3 py-2 text-xs sm:text-sm">
          Read khutbahs
        </Link>
        <a href={sermon.source_url} target="_blank" rel="noopener noreferrer" className="rounded-xl border border-subtle px-3 py-2 text-xs text-body hover:border-noor-300 sm:text-sm">
          Source
        </a>
      </div>
    </section>
  );
}
