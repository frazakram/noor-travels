"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { Lang } from "@/lib/i18n";

type LangContextType = { lang: Lang; setLang: (l: Lang) => void };

const LangContext = createContext<LangContextType>({ lang: "en", setLang: () => {} });

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>("en");

  useEffect(() => {
    const saved = localStorage.getItem("noor-lang") as Lang | null;
    if (saved && ["en", "ur", "hi"].includes(saved)) setLang(saved);
  }, []);

  useEffect(() => {
    localStorage.setItem("noor-lang", lang);
    document.documentElement.lang = lang === "ur" ? "ur" : lang === "hi" ? "hi" : "en";
    document.documentElement.dataset.uiLang = lang;
    // Keep layout chrome LTR — Urdu text blocks set dir="rtl" locally
    document.documentElement.dir = "ltr";
  }, [lang]);

  return <LangContext.Provider value={{ lang, setLang }}>{children}</LangContext.Provider>;
}

export function useLang() {
  return useContext(LangContext);
}
