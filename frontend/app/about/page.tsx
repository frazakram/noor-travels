"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useLang } from "@/components/LangProvider";
import { TimeOfDayHero } from "@/components/home/TimeOfDayHero";
import { api } from "@/lib/api";
import { FEATURED_VERSE_KEYS } from "@/lib/featured-verses";
import { cleanQuranText } from "@/lib/quran-display";
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

const STATS: { value: number; suffix: string; key: TKey }[] = [
  { value: 114, suffix: "", key: "aboutStatSurahs" },
  { value: 6236, suffix: "", key: "aboutStatAyahs" },
  { value: 7000, suffix: "+", key: "aboutStatHadiths" },
  { value: 30, suffix: "+", key: "aboutStatDuas" },
  { value: 3, suffix: "", key: "aboutStatLanguages" },
];

const WHY: { emoji: string; titleKey: TKey; descKey: TKey }[] = [
  { emoji: "📚", titleKey: "aboutWhySourcedTitle", descKey: "aboutWhySourcedDesc" },
  { emoji: "⚡", titleKey: "aboutWhyDailyTitle", descKey: "aboutWhyDailyDesc" },
  { emoji: "🌐", titleKey: "aboutWhyLangTitle", descKey: "aboutWhyLangDesc" },
];

const STEPS: { titleKey: TKey; descKey: TKey }[] = [
  { titleKey: "aboutHowStep1Title", descKey: "aboutHowStep1Desc" },
  { titleKey: "aboutHowStep2Title", descKey: "aboutHowStep2Desc" },
  { titleKey: "aboutHowStep3Title", descKey: "aboutHowStep3Desc" },
];

const SOURCES: { emoji: string; key: TKey }[] = [
  { emoji: "📖", key: "aboutSourceQuran" },
  { emoji: "📜", key: "aboutSourceHadith" },
  { emoji: "🇮🇳", key: "aboutSourceIndia" },
];

const LANGS: Lang[] = ["en", "ur", "hi"];

const REDUCED_MOTION = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Fades a section up into place the first time it scrolls into view, rather
 *  than only on initial page load — this is what makes a long landing page
 *  feel alive as you scroll instead of animating once above the fold. */
function Reveal({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (REDUCED_MOTION()) {
      setShown(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          obs.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${shown ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"} ${className}`}
    >
      {children}
    </div>
  );
}

/** Counts up from 0 once its stat card is scrolled into view. */
function Counter({ to, suffix }: { to: number; suffix: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [n, setN] = useState(REDUCED_MOTION() ? to : 0);

  useEffect(() => {
    if (REDUCED_MOTION()) return;
    const el = ref.current;
    if (!el) return;
    let started = false;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || started) return;
        started = true;
        const duration = 900;
        const start = performance.now();
        function tick(now: number) {
          const p = Math.min(1, (now - start) / duration);
          setN(Math.round(to * (1 - Math.pow(1 - p, 3))));
          if (p < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
        obs.disconnect();
      },
      { threshold: 0.4 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [to]);

  return (
    <span ref={ref}>
      {n.toLocaleString()}
      {suffix}
    </span>
  );
}

type Ayah = {
  verse_key: string;
  name_en?: string;
  arabic: string;
  translation_en: string;
  translation_ur: string;
  translation_hi?: string;
};

function todayDateKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export default function AboutPage() {
  const { lang } = useLang();
  const [ayah, setAyah] = useState<Ayah | null>(null);

  // Same rotating pool and date-hash as the home page's Ayah of the Day, so the
  // showcase quote here is a real verse rather than one hardcoded string that
  // would need re-translating by hand for every language.
  useEffect(() => {
    const verseKey = FEATURED_VERSE_KEYS[hashString(todayDateKey()) % FEATURED_VERSE_KEYS.length];
    api<Ayah>(`/api/quran/ayahs/${verseKey}`)
      .then(setAyah)
      .catch(() => setAyah(null));
  }, []);

  const ayahTranslation = ayah
    ? cleanQuranText(
        lang === "ur" ? ayah.translation_ur : lang === "hi" ? ayah.translation_hi || ayah.translation_en : ayah.translation_en,
      )
    : "";

  return (
    <div className="space-y-10 pb-12">
      <TimeOfDayHero phase="night">
        <div className="flex flex-col items-center gap-4 px-2 py-6 text-center sm:py-10">
          <Image
            src="/logo.png"
            alt=""
            width={72}
            height={72}
            className="h-16 w-16 animate-fade-in-up rounded-2xl shadow-lg shadow-black/30 sm:h-[72px] sm:w-[72px]"
          />
          <h1
            className="animate-fade-in-up text-3xl font-bold text-white drop-shadow-sm sm:text-4xl"
            style={{ animationDelay: "60ms" }}
          >
            {t(lang, "appName")}
          </h1>
          <p className="max-w-lg animate-fade-in-up text-sm text-white/85 sm:text-base" style={{ animationDelay: "120ms" }}>
            {t(lang, "aboutTagline")}
          </p>
          <div
            className="flex flex-wrap animate-fade-in-up items-center justify-center gap-2 pt-1"
            style={{ animationDelay: "180ms" }}
          >
            {LANGS.map((l) => (
              <span
                key={l}
                className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur-sm"
              >
                {t(lang, l === "en" ? "languageEnglish" : l === "ur" ? "languageUrdu" : "languageHindi")}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap animate-fade-in-up justify-center gap-3 pt-3" style={{ animationDelay: "240ms" }}>
            <Link
              href="/"
              className="rounded-xl bg-gradient-to-r from-gold-500 to-gold-400 px-6 py-3 text-sm font-semibold text-noor-950 shadow-lg shadow-black/20 transition hover:-translate-y-0.5 hover:scale-[1.03] hover:shadow-xl active:scale-95"
            >
              {t(lang, "aboutGetStarted")}
            </Link>
            <Link
              href="/#get-the-app"
              className="rounded-xl border border-white/30 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur-sm transition hover:-translate-y-0.5 hover:scale-[1.03] hover:bg-white/20 active:scale-95"
            >
              {t(lang, "getApp")}
            </Link>
          </div>
        </div>
      </TimeOfDayHero>

      <Reveal className="grid grid-cols-3 gap-3 sm:grid-cols-5">
        {STATS.map((s, i) => (
          <div
            key={s.key}
            className="card animate-fade-in-up text-center"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <p className="text-xl font-bold text-heading sm:text-2xl">
              <Counter to={s.value} suffix={s.suffix} />
            </p>
            <p className="mt-0.5 text-[11px] leading-tight text-faint sm:text-xs">{t(lang, s.key)}</p>
          </div>
        ))}
      </Reveal>

      <Reveal className="flex flex-wrap items-center justify-center gap-2">
        {SOURCES.map((src) => (
          <span
            key={src.key}
            className="inline-flex items-center gap-1.5 rounded-full border border-subtle bg-white px-3 py-1.5 text-xs font-medium text-muted dark:bg-noor-900"
          >
            <span aria-hidden>{src.emoji}</span>
            {t(lang, src.key)}
          </span>
        ))}
      </Reveal>

      <Reveal>
        <section className="space-y-4">
          <h2 className="text-center text-xl font-semibold text-heading">{t(lang, "aboutHowTitle")}</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {STEPS.map((step, i) => (
              <div key={step.titleKey} className="relative flex flex-col items-center gap-2 text-center">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-teal-600 to-noor-700 text-sm font-bold text-white shadow-md">
                  {i + 1}
                </span>
                <p className="font-medium text-heading">{t(lang, step.titleKey)}</p>
                <p className="max-w-[16rem] text-xs leading-relaxed text-faint">{t(lang, step.descKey)}</p>
                {i < STEPS.length - 1 && (
                  <span
                    className="absolute right-[-1.1rem] top-4 hidden text-lg text-noor-300 dark:text-noor-600 sm:block"
                    aria-hidden
                  >
                    →
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section className="space-y-4">
          <h2 className="text-center text-xl font-semibold text-heading">{t(lang, "aboutFeaturesTitle")}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f, i) => (
              <Link
                key={f.titleKey}
                href={f.href}
                className="card group animate-fade-in-up flex flex-col items-start gap-2.5 transition hover:-translate-y-1 hover:border-noor-300 hover:shadow-lg dark:hover:border-noor-500"
                style={{ animationDelay: `${i * 45}ms` }}
              >
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-gold-300 bg-gradient-to-br from-gold-50 to-white text-2xl shadow-sm transition group-hover:scale-110 dark:border-gold-600 dark:from-noor-800 dark:to-noor-900"
                  aria-hidden
                >
                  {f.emoji}
                </span>
                <div className="min-w-0">
                  <p className="font-medium text-heading">{t(lang, f.titleKey)}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-faint">{t(lang, f.descKey)}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </Reveal>

      {ayah && (
        <Reveal>
          <section className="card space-y-4 bg-gradient-to-br from-noor-50 to-white dark:from-noor-900/50 dark:to-noor-950">
            <p className="font-arabic text-right text-2xl leading-loose text-heading sm:text-3xl" dir="rtl">
              {cleanQuranText(ayah.arabic)}
            </p>
            <p className="text-sm leading-relaxed text-body sm:text-base" dir={lang === "ur" ? "rtl" : "ltr"}>
              {ayahTranslation}
            </p>
            <p className="text-xs font-medium text-accent">
              {ayah.name_en ?? "Quran"} · {ayah.verse_key}
            </p>
          </section>
        </Reveal>
      )}

      <Reveal>
        <section className="space-y-4">
          <h2 className="text-center text-xl font-semibold text-heading">{t(lang, "aboutWhyTitle")}</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {WHY.map((w) => (
              <div key={w.titleKey} className="card space-y-1.5 text-center transition hover:-translate-y-1 hover:shadow-lg">
                <span className="text-2xl" aria-hidden>
                  {w.emoji}
                </span>
                <p className="font-medium text-heading">{t(lang, w.titleKey)}</p>
                <p className="text-xs leading-relaxed text-faint">{t(lang, w.descKey)}</p>
              </div>
            ))}
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-noor-800 via-noor-700 to-teal-800 px-6 py-10 text-center shadow-xl">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gold-400/20 blur-3xl" aria-hidden />
          <div className="pointer-events-none absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-teal-400/20 blur-3xl" aria-hidden />
          <h2 className="relative text-2xl font-bold text-white sm:text-3xl">{t(lang, "aboutCtaTitle")}</h2>
          <p className="relative mx-auto mt-2 max-w-md text-sm text-white/80">{t(lang, "aboutCtaBody")}</p>
          <div className="relative mt-5 flex flex-wrap justify-center gap-3">
            <Link
              href="/"
              className="rounded-xl bg-gradient-to-r from-gold-500 to-gold-400 px-6 py-3 text-sm font-semibold text-noor-950 shadow-lg transition hover:-translate-y-0.5 hover:scale-[1.03] hover:shadow-xl active:scale-95"
            >
              {t(lang, "aboutGetStarted")}
            </Link>
            <Link
              href="/settings"
              className="rounded-xl border border-white/30 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur-sm transition hover:-translate-y-0.5 hover:scale-[1.03] hover:bg-white/20 active:scale-95"
            >
              {t(lang, "settings")}
            </Link>
          </div>
        </section>
      </Reveal>
    </div>
  );
}
