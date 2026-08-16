"use client";

import Image from "next/image";
import Link from "next/link";
import { useLang } from "@/components/LangProvider";
import { t } from "@/lib/i18n";

export default function SupportUsPage() {
  const { lang } = useLang();

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-10">
      <div>
        <Link href="/" className="text-sm font-medium text-accent hover:underline">
          ← {t(lang, "home")}
        </Link>
        <h1 className="mt-3 text-2xl font-bold text-heading">{t(lang, "supportUs")}</h1>
      </div>

      <section className="card relative overflow-hidden">
        <div className="float-right mb-3 ml-4 w-28 sm:w-36">
          <Image
            src="/support-qr.png"
            alt={t(lang, "supportUsQrHint")}
            width={697}
            height={739}
            className="h-auto w-full rounded-xl border border-subtle bg-black shadow-sm"
            unoptimized
            priority
          />
        </div>

        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-body sm:text-base">{t(lang, "supportUsBody")}</p>

          <blockquote className="border-l-2 border-gold-400 pl-3 dark:border-gold-500">
            <p className="text-sm italic leading-relaxed text-heading sm:text-base">{t(lang, "supportUsHadith")}</p>
            <cite className="mt-1.5 block text-xs not-italic text-muted">— {t(lang, "supportUsHadithSource")}</cite>
          </blockquote>

          <p className="text-sm leading-relaxed text-body sm:text-base">{t(lang, "supportUsClosing")}</p>
        </div>
      </section>
    </div>
  );
}
