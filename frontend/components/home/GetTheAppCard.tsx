"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useLang } from "@/components/LangProvider";
import { APK_QR_SRC, APK_URL, fetchAppVersion, isAndroidBrowser, isInsideApp } from "@/lib/apk";
import { GET_APP_ANCHOR } from "@/components/home/InstallAppPrompt";
import { t } from "@/lib/i18n";

/**
 * Real APK download, on the home page.
 *
 * Hidden inside the APK — someone reading this in the app already has it. The
 * user-agent checks can only run after mount, so the card is absent from the
 * server-rendered HTML rather than flashing the wrong state on hydration.
 */
export function GetTheAppCard() {
  const { lang } = useLang();
  const [show, setShow] = useState(false);
  const [onAndroid, setOnAndroid] = useState(false);
  const [version, setVersion] = useState("");
  const [openSteps, setOpenSteps] = useState(false);

  useEffect(() => {
    if (isInsideApp()) return;
    setShow(true);
    setOnAndroid(isAndroidBrowser());
    void fetchAppVersion().then((v) => v && setVersion(v.versionName));
  }, []);

  if (!show) return null;

  const steps = [t(lang, "downloadStep1"), t(lang, "downloadStep2"), t(lang, "downloadStep3")];

  return (
    <section id={GET_APP_ANCHOR} className="card scroll-mt-24 space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-3">
          <div className="flex items-center gap-3">
            <Image src="/logo-sm.png" alt="" width={44} height={44} className="h-11 w-11 shrink-0 rounded-xl" />
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-heading">{t(lang, "downloadTitle")}</h2>
              <p className="text-xs text-muted">
                {version ? `${t(lang, "downloadVersion")} ${version}` : t(lang, "downloadAndroidOnly")}
              </p>
            </div>
          </div>
          <p className="text-sm text-body">{t(lang, "downloadSubtitle")}</p>
          <div className="flex flex-wrap items-center gap-3">
            <a
              // Cross-origin, so a `download` attribute would be ignored —
              // GitHub's Content-Disposition: attachment is what downloads it.
              href={APK_URL}
              rel="noopener"
              className="btn-primary inline-flex min-h-11 items-center gap-2 px-5"
            >
              ⬇ {t(lang, "downloadCta")}
            </a>
            <button
              type="button"
              onClick={() => setOpenSteps((v) => !v)}
              className="text-xs font-medium text-accent hover:underline"
            >
              {t(lang, "downloadHowTo")} {openSteps ? "▲" : "▼"}
            </button>
          </div>
          <p className="text-xs text-faint">{t(lang, "downloadSizeNote")}</p>
        </div>

        {/* Desktop readers cannot install an APK on the machine they are on. */}
        {!onAndroid && (
          <div className="flex shrink-0 flex-col items-center gap-1.5 self-center rounded-2xl border border-subtle p-3">
            <Image
              src={APK_QR_SRC}
              alt={t(lang, "downloadQrAlt")}
              width={112}
              height={112}
              className="h-28 w-28 rounded-lg bg-white p-1"
              unoptimized
            />
            <p className="max-w-[8rem] text-center text-[11px] leading-tight text-muted">
              {t(lang, "downloadQrHint")}
            </p>
          </div>
        )}
      </div>

      {openSteps && (
        <div className="space-y-2 border-t border-subtle pt-3">
          <ol className="space-y-2">
            {steps.map((step, i) => (
              <li key={i} className="flex gap-2.5 text-sm text-body">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-700 text-[11px] font-semibold text-white dark:bg-teal-600">
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <p className="text-xs text-faint">{t(lang, "downloadTrustNote")}</p>
        </div>
      )}
    </section>
  );
}
