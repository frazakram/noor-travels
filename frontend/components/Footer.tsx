"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLang } from "@/components/LangProvider";
import { t } from "@/lib/i18n";
import { nativeAppVersion } from "@/lib/native-bridge";
import versionInfo from "@/public/app-version.json";

export function Footer() {
  const { lang } = useLang();
  // Single source of truth: public/app-version.json — the same file the
  // Android updater polls and the download card reads, so bumping it per the
  // release SOP updates every surface at once. Inside the APK the bridge
  // reports the installed build instead, which is the honest number there
  // (the WebView content updates independently of the APK).
  const [version, setVersion] = useState(`v${versionInfo.versionName}`);

  useEffect(() => {
    const installed = nativeAppVersion();
    if (installed) setVersion(`v${installed}`);
  }, []);

  return (
    <footer className="border-t border-subtle bg-white/70 px-4 py-6 pb-safe text-xs text-muted md:backdrop-blur dark:bg-noor-950/70">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p>{t(lang, "forLearningDisclaimer")}</p>
        <div className="flex items-center gap-4">
          <Link href="/about" prefetch={false} className="hover:text-heading">{t(lang, "about")}</Link>
          <Link href="/support" prefetch={false} className="hover:text-heading">{t(lang, "supportUs")}</Link>
          <Link href="/privacy" prefetch={false} className="hover:text-heading">{t(lang, "privacy")}</Link>
          <span className="rounded-full bg-noor-50 px-2 py-1 text-[10px] font-medium dark:bg-noor-900">
            {version}
          </span>
        </div>
      </div>
    </footer>
  );
}
