"use client";

import { useLang } from "@/components/LangProvider";
import { useTheme } from "@/components/ThemeProvider";
import { Tooltip } from "@/components/Tooltip";
import { t } from "@/lib/i18n";

type Props = {
  /** fixed = floating button like chat; inline = compact for nav header */
  variant?: "fixed" | "inline";
};

export function ThemeToggle({ variant = "fixed" }: Props) {
  const { theme, toggleTheme } = useTheme();
  const { lang } = useLang();
  const isDark = theme === "dark";
  const label = isDark ? t(lang, "lightMode") : t(lang, "darkMode");

  const icon = isDark ? (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
      <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z" />
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
      <path
        fillRule="evenodd"
        d="M9.528 1.718a.75.75 0 01.162.819A8.97 8.97 0 009 6a9 9 0 009 9 8.97 8.97 0 003.463-.69.75.75 0 01.981.98 10.503 10.503 0 01-9.694 6.46c-5.799 0-10.5-4.701-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 01.818.162z"
        clipRule="evenodd"
      />
    </svg>
  );

  const btnInline =
    "flex h-8 w-8 items-center justify-center rounded-lg border border-noor-200 bg-white text-noor-700 transition-all duration-150 hover:scale-105 active:scale-95 dark:border-noor-600 dark:bg-noor-800 dark:text-gold-400 dark:hover:bg-noor-700";
  const btnFixed =
    "flex h-14 w-14 items-center justify-center rounded-full border border-noor-200 bg-white text-noor-700 shadow-lg transition-all duration-150 hover:scale-105 hover:shadow-xl active:scale-95 dark:border-noor-600 dark:bg-noor-800 dark:text-gold-400 dark:hover:bg-noor-700";

  if (variant === "inline") {
    return (
      <Tooltip label={label} side="bottom">
        <button type="button" onClick={toggleTheme} aria-label={label} className={btnInline}>
          {icon}
        </button>
      </Tooltip>
    );
  }

  return (
    <div className="fixed bottom-5 left-5 z-50">
      <Tooltip label={label} side="top">
        <button type="button" onClick={toggleTheme} aria-label={label} className={btnFixed}>
          {icon}
        </button>
      </Tooltip>
    </div>
  );
}
