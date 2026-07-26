"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLang } from "@/components/LangProvider";
import { formatKhutbaDate, lastSavedKhutba, type SavedKhutba } from "@/lib/khutba-history";
import { t } from "@/lib/i18n";

/** Home card for the most recently saved live-khutba session. Renders nothing
 *  when the user has never saved one. */
export function LastSavedKhutba() {
  const { lang } = useLang();
  const [khutba, setKhutba] = useState<SavedKhutba | null>(null);

  useEffect(() => {
    setKhutba(lastSavedKhutba());
  }, []);

  if (!khutba) return null;

  const preview = khutba.lines
    .map((l) => l.english)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 220);

  return (
    <section className="card relative overflow-hidden border-gold-100 bg-gradient-to-br from-gold-50 to-white p-4 dark:border-gold-500/30 dark:from-noor-900 dark:to-noor-950 sm:p-5">
      <div className="absolute -right-14 -top-14 h-36 w-36 rounded-full bg-gold-300/20 blur-3xl" />
      <p className="text-xs font-semibold uppercase tracking-wider text-accent">
        {t(lang, "lastSavedKhutbaTitle")}
      </p>
      <h2 className="mt-2 text-lg font-bold text-heading sm:text-xl">
        {khutba.matchedTitle || t(lang, "savedKhutbaTitle")}
      </h2>
      <p className="mt-1 text-xs text-muted">
        {formatKhutbaDate(khutba.savedAt, lang)}
        {khutba.location ? ` · 📍 ${khutba.location}` : ""}
      </p>
      {preview && (
        <p className="mt-2 max-w-3xl text-xs leading-relaxed text-body sm:text-sm">{preview}…</p>
      )}
      <div className="mt-3">
        <Link
          href={`/khutba?saved=${encodeURIComponent(khutba.id)}`}
          className="btn-primary inline-block px-3 py-2 text-xs sm:text-sm"
        >
          {t(lang, "readSavedKhutba")}
        </Link>
      </div>
    </section>
  );
}
