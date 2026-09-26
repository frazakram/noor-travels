"use client";

import Link from "next/link";
import { useLang } from "@/components/LangProvider";
import { t } from "@/lib/i18n";

const LINKS = [
  { href: "/", key: "home" },
  { href: "/quran", key: "quran" },
  { href: "/hadith?section=duas", key: "duas" },
  { href: "/hadith", key: "hadith" },
  { href: "/learn-quran", key: "learnQuran" },
] as const;

export function NotFoundContent() {
  const { lang } = useLang();
  return (
    <section className="mx-auto flex max-w-md flex-col items-center gap-6 py-16 text-center">
      <p className="text-6xl font-bold text-noor-300 dark:text-noor-700">404</p>
      <div>
        <h1 className="text-2xl font-bold text-heading">{t(lang, "pageNotFound")}</h1>
        <p className="mt-2 text-muted">{t(lang, "pageNotFoundBody")}</p>
      </div>
      <nav aria-label={t(lang, "helpfulLinks")} className="flex flex-wrap justify-center gap-2">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="touch-target rounded-full border border-noor-200 px-4 py-2 text-sm font-medium text-noor-800 transition hover:bg-noor-50 dark:border-noor-700 dark:text-noor-100 dark:hover:bg-noor-900"
          >
            {t(lang, l.key)}
          </Link>
        ))}
      </nav>
    </section>
  );
}
