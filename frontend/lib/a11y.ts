"use client";

export type FontScale = "sm" | "md" | "lg" | "xl";

const A11Y_KEY = "noor-a11y";

export type A11yPrefs = {
  fontScale: FontScale;
  highContrast: boolean;
};

export const DEFAULT_A11Y: A11yPrefs = {
  fontScale: "md",
  highContrast: false,
};

const SCALE_MAP: Record<FontScale, string> = {
  sm: "0.92",
  md: "1",
  lg: "1.12",
  xl: "1.25",
};

export function loadA11yPrefs(): A11yPrefs {
  if (typeof window === "undefined") return DEFAULT_A11Y;
  try {
    const raw = localStorage.getItem(A11Y_KEY);
    if (!raw) return DEFAULT_A11Y;
    const v = JSON.parse(raw);
    const fontScale = (["sm", "md", "lg", "xl"] as FontScale[]).includes(v.fontScale)
      ? (v.fontScale as FontScale)
      : "md";
    return { fontScale, highContrast: Boolean(v.highContrast) };
  } catch {
    return DEFAULT_A11Y;
  }
}

export function saveA11yPrefs(prefs: A11yPrefs): void {
  localStorage.setItem(A11Y_KEY, JSON.stringify(prefs));
}

export function applyA11yPrefs(prefs: A11yPrefs): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.setProperty("--text-scale", SCALE_MAP[prefs.fontScale] ?? "1");
  root.classList.toggle("high-contrast", prefs.highContrast);
  root.dataset.fontScale = prefs.fontScale;
}
