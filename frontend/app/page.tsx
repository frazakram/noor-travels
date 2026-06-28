"use client";

import Link from "next/link";
import { useLang } from "@/components/LangProvider";
import { useChat } from "@/components/ChatProvider";
import { t } from "@/lib/i18n";

const features = [
  { href: "/quran", key: "quran" as const, desc: "Arabic + Sahih International + Jalandhry + roman" },
  { href: "/hadith", key: "hadith" as const, desc: "Search Sahih al-Bukhari" },
  { href: "/duas", key: "duas" as const, desc: "Authentic travel duas" },
  { href: "/khutba", key: "khutba" as const, desc: "Live Arabic → English + Urdu" },
];

export default function HomePage() {
  const { lang } = useLang();
  const { openChat } = useChat();

  return (
    <div className="space-y-8">
      <section className="card bg-gradient-to-br from-noor-800 to-noor-950 text-white">
        <p className="text-gold-400 text-sm font-medium">{t(lang, "appName")}</p>
        <h1 className="mt-2 text-3xl font-bold md:text-4xl">{t(lang, "tagline")}</h1>
        <p className="mt-3 max-w-xl text-noor-100 text-sm leading-relaxed">
          {t(lang, "disclaimer")}
        </p>
        <button
          onClick={openChat}
          className="mt-4 rounded-xl bg-gold-400 px-5 py-2.5 text-sm font-medium text-noor-950 hover:bg-gold-500"
        >
          {t(lang, "openChat")}
        </button>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        {features.map((f) => (
          <Link key={f.href} href={f.href} className="card transition hover:border-noor-300 hover:shadow-md">
            <h2 className="text-lg font-semibold text-noor-800">{t(lang, f.key)}</h2>
            <p className="mt-1 text-sm text-noor-600">{f.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
