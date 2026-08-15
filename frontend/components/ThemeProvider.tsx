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

  useEffect(() => {
    const initial = readStoredTheme();
    setThemeState(initial);
    applyTheme(initial);
    const prefs = loadA11yPrefs();
    setA11y(prefs);
    applyA11yPrefs(prefs);
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

  // theme must start "light" on every render path — server and client alike — and
  // only pick up the real value once the effect above runs. Reading localStorage
  // here on the client's first render (as this used to) makes that first render
  // diverge from the server's, which is a hydration mismatch: React throws
  // (minified error #418) and, in a production build, that is fatal — it aborts
  // hydration for the whole tree, so every client component below downgrades to
  // inert HTML (this took out the chat FAB, the install prompt and the download
  // card together, which is what made them look "missing"). The inline blocking
  // script in <head> already applies the dark class before first paint, so there
  // is no flash-of-wrong-theme to trade away by waiting for the effect here.
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
