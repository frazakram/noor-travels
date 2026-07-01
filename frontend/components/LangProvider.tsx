"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, startTransition } from "react";
import type { Lang } from "@/lib/i18n";

type LangContextType = { lang: Lang; setLang: (l: Lang) => void };

const LangContext = createContext<LangContextType>({ lang: "en", setLang: () => {} });

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    const saved = localStorage.getItem("noor-lang") as Lang | null;
    if (saved && ["en", "ur", "hi"].includes(saved)) setLangState(saved);
  }, []);

  useEffect(() => {
    localStorage.setItem("noor-lang", lang);
    document.documentElement.lang = lang === "ur" ? "ur" : lang === "hi" ? "hi" : "en";
    document.documentElement.dataset.uiLang = lang;
    // Keep layout chrome LTR — Urdu text blocks set dir="rtl" locally
    document.documentElement.dir = "ltr";
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    startTransition(() => setLangState(next));
  }, []);

  const value = useMemo(() => ({ lang, setLang }), [lang, setLang]);

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang() {
  return useContext(LangContext);
}
