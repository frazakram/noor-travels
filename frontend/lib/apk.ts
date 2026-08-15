/** Single source of truth for the Android build users can install. */

/** GitHub serves this with Content-Disposition: attachment and the
 *  application/vnd.android.package-archive type, so following it downloads the
 *  APK rather than rendering anything. Cross-origin, so an `<a download>`
 *  attribute would be ignored — the header is what makes it a download. */
export const APK_URL =
  "https://github.com/frazakram/noor-safar-releases/releases/latest/download/app-release.apk";

/** Pre-rendered at build time from APK_URL (public/apk-qr.svg) so the page
 *  needs no QR library at runtime. Regenerate if APK_URL ever changes. */
export const APK_QR_SRC = "/apk-qr.svg";

export type AppVersion = { versionCode: number; versionName: string; url?: string };

/** Reads public/app-version.json — the same file the APK's updater polls, so
 *  the page can never advertise a version the in-app prompt disagrees with. */
export async function fetchAppVersion(): Promise<AppVersion | null> {
  try {
    const res = await fetch("/app-version.json", { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    if (typeof data?.versionName !== "string") return null;
    return data as AppVersion;
  } catch {
    return null;
  }
}

/** True inside the Android WebView, where offering the APK is pointless. */
export function isInsideApp(): boolean {
  if (typeof window === "undefined") return false;
  return (
    /NoorSafarAndroid/i.test(navigator.userAgent || "") ||
    document.documentElement.classList.contains("app-shell")
  );
}

export function isAndroidBrowser(): boolean {
  if (typeof window === "undefined") return false;
  return /Android/i.test(navigator.userAgent || "") && !isInsideApp();
}
