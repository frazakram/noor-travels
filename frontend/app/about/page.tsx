"use client";

import Image from "next/image";
import Link from "next/link";
import { useLang } from "@/components/LangProvider";
import { t, type Lang } from "@/lib/i18n";

type TKey = Parameters<typeof t>[1];

type Feature = {
  emoji: string;
  titleKey: TKey;
  descKey: TKey;
  href: string;
};

const FEATURES: Feature[] = [
  { emoji: "📖", titleKey: "aboutFeatureQuranTitle", descKey: "aboutFeatureQuranDesc", href: "/quran" },
  { emoji: "🕌", titleKey: "aboutFeatureSalahTitle", descKey: "aboutFeatureSalahDesc", href: "/" },
  { emoji: "📜", titleKey: "aboutFeatureHadithTitle", descKey: "aboutFeatureHadithDesc", href: "/hadith" },
  { emoji: "🤲", titleKey: "aboutFeatureDuasTitle", descKey: "aboutFeatureDuasDesc", href: "/duas" },
  { emoji: "💬", titleKey: "aboutFeatureAskTitle", descKey: "aboutFeatureAskDesc", href: "/library" },
  { emoji: "🎙️", titleKey: "aboutFeatureKhutbaTitle", descKey: "aboutFeatureKhutbaDesc", href: "/khutba" },
  { emoji: "🎓", titleKey: "aboutFeatureLearnTitle", descKey: "aboutFeatureLearnDesc", href: "/learn-quran" },
  { emoji: "🎧", titleKey: "aboutFeatureReciteTitle", descKey: "aboutFeatureReciteDesc", href: "/recite" },
];

const LANGS: Lang[] = ["en", "ur", "hi"];

export default function AboutPage() {
  const { lang } = useLang();

  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-12">
      <div className="card space-y-3 bg-gradient-to-br from-noor-50 to-white text-center dark:from-noor-900/60 dark:to-noor-950">
        <Image
          src="/logo.png"
          alt=""
          width={64}
          height={64}
          className="mx-auto h-16 w-16 rounded-2xl shadow-sm"
        />
        <h1 className="text-2xl font-bold text-heading sm:text-3xl">{t(lang, "appName")}</h1>
        <p className="mx-auto max-w-lg text-sm text-body">{t(lang, "aboutTagline")}</p>
        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
          {LANGS.map((l) => (
            <span
              key={l}
              className="rounded-full border border-subtle bg-white px-3 py-1 text-xs font-medium text-muted dark:bg-noor-900"
            >
              {t(lang, l === "en" ? "languageEnglish" : l === "ur" ? "languageUrdu" : "languageHindi")}
            </span>
          ))}
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-heading">{t(lang, "aboutFeaturesTitle")}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <Link
              key={f.titleKey}
              href={f.href}
              className="card flex items-start gap-3 hover:border-noor-300 dark:hover:border-noor-500"
            >
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gold-300 bg-gold-50 text-xl dark:border-gold-600 dark:bg-noor-800"
                aria-hidden
              >
                {f.emoji}
              </span>
              <div className="min-w-0">
                <p className="font-medium text-heading">{t(lang, f.titleKey)}</p>
                <p className="mt-0.5 text-xs text-faint">{t(lang, f.descKey)}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="card space-y-2">
        <h2 className="text-sm font-semibold text-heading">{t(lang, "aboutWhyTitle")}</h2>
        <p className="text-sm leading-relaxed text-body">{t(lang, "aboutWhyBody")}</p>
      </section>

      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/" className="btn-primary">
          {t(lang, "aboutGetStarted")}
        </Link>
        <Link
          href="/settings"
          className="rounded-xl border border-subtle px-5 py-2.5 text-sm font-medium text-body hover:border-noor-300"
        >
          {t(lang, "settings")}
        </Link>
      </div>

      <p className="text-center text-xs text-faint">{t(lang, "aboutDisclaimer")}</p>
    </div>
  );
}
