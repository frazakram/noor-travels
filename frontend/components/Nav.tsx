"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLang } from "@/components/LangProvider";
import { t, type Lang } from "@/lib/i18n";

const links = [
  { href: "/", key: "home" as const },
  { href: "/quran", key: "quran" as const },
  { href: "/hadith", key: "hadith" as const },
  { href: "/duas", key: "duas" as const },
  { href: "/khutba", key: "khutba" as const },
];

export function Nav() {
  const pathname = usePathname();
  const { lang, setLang } = useLang();

  return (
    <header className="sticky top-0 z-50 border-b border-noor-800/10 bg-sand-50/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="font-semibold text-noor-800">
          {t(lang, "appName")}
        </Link>
        <nav className="hidden gap-1 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-lg px-3 py-1.5 text-sm transition ${
                pathname === l.href
                  ? "bg-noor-700 text-white"
                  : "text-noor-700 hover:bg-noor-100"
              }`}
            >
              {t(lang, l.key)}
            </Link>
          ))}
        </nav>
        <div className="flex gap-1">
          {(["en", "ur", "hi"] as Lang[]).map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={`rounded-md px-2 py-1 text-xs font-medium uppercase ${
                lang === l ? "bg-gold-400 text-noor-950" : "bg-noor-100 text-noor-700"
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
      <nav className="flex gap-1 overflow-x-auto border-t border-noor-100 px-4 py-2 md:hidden">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`shrink-0 rounded-lg px-3 py-1 text-xs ${
              pathname === l.href ? "bg-noor-700 text-white" : "bg-noor-50 text-noor-700"
            }`}
          >
            {t(lang, l.key)}
          </Link>
        ))}
      </nav>
    </header>
  );
}
