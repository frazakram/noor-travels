"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useLang } from "@/components/LangProvider";
import { NoticeCard } from "@/components/NoticeCard";
import { APK_QR_SRC, APK_URL, fetchAppVersion, isAndroidBrowser, isInsideApp } from "@/lib/apk";
import { t } from "@/lib/i18n";

export default function DownloadPage() {
  const { lang } = useLang();
  const [version, setVersion] = useState("");
  const [onAndroid, setOnAndroid] = useState(false);
  const [inApp, setInApp] = useState(false);
  const [ready, setReady] = useState(false);

  // All of this depends on the user agent, so it can only run after mount —
  // rendering it during SSR would ship one device's answer to every device.
  useEffect(() => {
    setOnAndroid(isAndroidBrowser());
    setInApp(isInsideApp());
    setReady(true);
    void fetchAppVersion().then((v) => v && setVersion(v.versionName));
  }, []);

  const steps = [
    t(lang, "downloadStep1"),
    t(lang, "downloadStep2"),
    t(lang, "downloadStep3"),
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-12">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-heading sm:text-3xl">{t(lang, "downloadTitle")}</h1>
        <p className="text-sm text-muted">{t(lang, "downloadSubtitle")}</p>
      </div>

      {ready && inApp && (
        <NoticeCard
          tone="info"
          title={t(lang, "downloadAlreadyInApp")}
          message={t(lang, "downloadAlreadyInAppHint")}
        />
      )}

      <section className="card space-y-5">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex items-center gap-2">
              <Image src="/logo-sm.png" alt="" width={48} height={48} className="h-12 w-12 rounded-xl" />
              <div>
                <p className="font-semibold text-heading">{t(lang, "appName")}</p>
                <p className="text-xs text-muted">
                  {version ? `${t(lang, "downloadVersion")} ${version}` : t(lang, "downloadAndroidOnly")}
                </p>
              </div>
            </div>
            <a
              href={APK_URL}
              // Cross-origin, so `download` is ignored — GitHub's
              // Content-Disposition: attachment is what makes this a real
              // download rather than a navigation.
              rel="noopener"
              className="btn-primary inline-flex min-h-11 items-center gap-2 px-5"
            >
              ⬇ {t(lang, "downloadCta")}
            </a>
            <p className="text-xs text-faint">{t(lang, "downloadSizeNote")}</p>
          </div>

          {/* Desktop visitors cannot install an APK on the machine they are
              reading this on, so give them a way onto the phone. */}
          {ready && !onAndroid && (
            <div className="flex shrink-0 flex-col items-center gap-2 rounded-2xl border border-subtle p-4">
              <Image
                src={APK_QR_SRC}
                alt={t(lang, "downloadQrAlt")}
                width={132}
                height={132}
                className="h-33 w-33 rounded-lg bg-white p-1"
                unoptimized
              />
              <p className="max-w-[9rem] text-center text-xs text-muted">{t(lang, "downloadQrHint")}</p>
            </div>
          )}
        </div>
      </section>

      <section className="card space-y-3">
        <h2 className="text-sm font-semibold text-heading">{t(lang, "downloadHowTo")}</h2>
        <ol className="space-y-2">
          {steps.map((step, i) => (
            <li key={i} className="flex gap-3 text-sm text-body">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-700 text-xs font-semibold text-white dark:bg-teal-600">
                {i + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        <p className="text-xs text-faint">{t(lang, "downloadTrustNote")}</p>
      </section>

      <section className="card space-y-2">
        <h2 className="text-sm font-semibold text-heading">{t(lang, "downloadWhyApp")}</h2>
        <ul className="space-y-1.5 text-sm text-body">
          <li>• {t(lang, "downloadPerk1")}</li>
          <li>• {t(lang, "downloadPerk2")}</li>
          <li>• {t(lang, "downloadPerk3")}</li>
        </ul>
      </section>
    </div>
  );
}
