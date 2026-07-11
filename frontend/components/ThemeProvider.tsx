"use client";

import { createContext, useContext, useEffect, useState } from "react";
import {
  applyA11yPrefs,
  DEFAULT_A11Y,
  loadA11yPrefs,
  saveA11yPrefs,
  type A11yPrefs,
  type FontScale,
} from "@/lib/a11y";

export type Theme = "light" | "dark";

type ThemeContextType = {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
  fontScale: FontScale;
  highContrast: boolean;
  setFontScale: (s: FontScale) => void;
  setHighContrast: (v: boolean) => void;
};

const ThemeContext = createContext<ThemeContextType>({
  theme: "light",
  setTheme: () => {},
  toggleTheme: () => {},
  fontScale: "md",
  highContrast: false,
  setFontScale: () => {},
  setHighContrast: () => {},
});

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");
  const [a11y, setA11y] = useState<A11yPrefs>(DEFAULT_A11Y);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("noor-theme") as Theme | null;
    const initial: Theme = saved === "dark" ? "dark" : "light";
    setThemeState(initial);
    applyTheme(initial);
    const prefs = loadA11yPrefs();
    setA11y(prefs);
    applyA11yPrefs(prefs);
    setReady(true);
  }, []);

  function setTheme(next: Theme) {
    setThemeState(next);
    localStorage.setItem("noor-theme", next);
    applyTheme(next);
  }

  function toggleTheme() {
    setTheme(theme === "dark" ? "light" : "dark");
  }

  function setFontScale(fontScale: FontScale) {
    const next = { ...a11y, fontScale };
    setA11y(next);
    saveA11yPrefs(next);
    applyA11yPrefs(next);
  }

  function setHighContrast(highContrast: boolean) {
    const next = { ...a11y, highContrast };
    setA11y(next);
    saveA11yPrefs(next);
    applyA11yPrefs(next);
  }

  if (!ready) {
    return <>{children}</>;
  }

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        toggleTheme,
        fontScale: a11y.fontScale,
        highContrast: a11y.highContrast,
        setFontScale,
        setHighContrast,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
