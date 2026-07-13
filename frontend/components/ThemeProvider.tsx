"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  applyA11yPrefs,
  DEFAULT_A11Y,
  loadA11yPrefs,
  saveA11yPrefs,
  type A11yPrefs,
  type FontScale,
} from "@/lib/a11y";
import { schedulePrefsPush, wirePrefsSyncOnAuth } from "@/lib/user-prefs";

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

function readStoredTheme(): Theme {
  try {
    return localStorage.getItem("noor-theme") === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");
  const [a11y, setA11y] = useState<A11yPrefs>(DEFAULT_A11Y);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const initial = readStoredTheme();
    setThemeState(initial);
    applyTheme(initial);
    const prefs = loadA11yPrefs();
    setA11y(prefs);
    applyA11yPrefs(prefs);
    setReady(true);
  }, []);

  useEffect(() => wirePrefsSyncOnAuth(), []);

  useEffect(() => {
    const onPrefs = () => {
      const next = readStoredTheme();
      setThemeState(next);
      applyTheme(next);
      const prefs = loadA11yPrefs();
      setA11y(prefs);
      applyA11yPrefs(prefs);
    };
    window.addEventListener("noor:prefs-changed", onPrefs);
    return () => window.removeEventListener("noor:prefs-changed", onPrefs);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    try {
      localStorage.setItem("noor-theme", next);
    } catch {
      /* private mode */
    }
    applyTheme(next);
    schedulePrefsPush({ theme: next });
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      try {
        localStorage.setItem("noor-theme", next);
      } catch {
        /* private mode */
      }
      applyTheme(next);
      schedulePrefsPush({ theme: next });
      return next;
    });
  }, []);

  const setFontScale = useCallback((fontScale: FontScale) => {
    setA11y((prev) => {
      const next = { ...prev, fontScale };
      saveA11yPrefs(next);
      applyA11yPrefs(next);
      schedulePrefsPush({ a11y: next });
      return next;
    });
  }, []);

  const setHighContrast = useCallback((highContrast: boolean) => {
    setA11y((prev) => {
      const next = { ...prev, highContrast };
      saveA11yPrefs(next);
      applyA11yPrefs(next);
      schedulePrefsPush({ a11y: next });
      return next;
    });
  }, []);

  // Always provide context so toggles work during hydration (theme still applied via script + effect).
  return (
    <ThemeContext.Provider
      value={{
        theme: ready ? theme : readStoredThemeSafe(),
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

function readStoredThemeSafe(): Theme {
  if (typeof window === "undefined") return "light";
  return readStoredTheme();
}

export function useTheme() {
  return useContext(ThemeContext);
}
