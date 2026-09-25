"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AppLogo } from "@/components/AppLogo";
import { Icon } from "@/components/Icon";
import { useLang } from "@/components/LangProvider";
import type { useSalah } from "@/hooks/useSalah";
import { PRAYER_METHODS } from "@/lib/salah";
import { t, type Lang } from "@/lib/i18n";

const DONE_KEY = "noor-onboarded";

/** Any of these means the app was used before this screen existed — don't onboard them again. */
const EXISTING_USER_KEYS = [
  "noor-salah-settings",
  "noor-salah-coords",
  "noor-salah-manual-location",
  "noor-quran-last-read",
  "noor-auth-token",
  "noor-prefs-updated-at",
];

const LANGS: { id: Lang; label: string }[] = [
  { id: "en", label: "English" },
  { id: "ur", label: "اردو" },
  { id: "hi", label: "हिन्दी" },
];

function shouldOnboard(): boolean {
  try {
    if (localStorage.getItem(DONE_KEY)) return false;
    if (EXISTING_USER_KEYS.some((k) => localStorage.getItem(k) !== null)) {
      localStorage.setItem(DONE_KEY, "1");
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function Onboarding({ salah }: { salah: ReturnType<typeof useSalah> }) {
  const { lang, setLang } = useLang();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [method, setMethod] = useState(salah.settings.method);
  const [school, setSchool] = useState<0 | 1>(salah.settings.school);

  useEffect(() => setOpen(shouldOnboard()), []);

  useEffect(() => {
    setMethod(salah.settings.method);
    setSchool(salah.settings.school);
  }, [salah.settings.method, salah.settings.school]);

  if (!open) return null;

  function finish(saveCalc: boolean) {
    if (saveCalc) salah.setSettings({ ...salah.settings, method, school });
    try {
      localStorage.setItem(DONE_KEY, "1");
    } catch {
      /* private mode — it will simply show again next visit */
    }
    setOpen(false);
  }

  const choice = (active: boolean) =>
    `w-full rounded-2xl border px-4 py-3.5 text-start text-sm font-medium transition-colors ${
      active
        ? "border-noor-700 bg-noor-50 text-noor-900 dark:border-gold-300 dark:bg-noor-800 dark:text-white"
        : "border-noor-100 text-heading hover:border-noor-300 dark:border-noor-800"
    }`;

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-end justify-center bg-black/50 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={t(lang, "onbWelcome")}>
      <div className="flex max-h-[92vh] w-full flex-col overflow-y-auto rounded-t-3xl bg-white p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] sm:max-w-md sm:rounded-3xl sm:pb-6 dark:bg-noor-900">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <AppLogo size={32} className="h-8 w-8" />
            <span className="text-sm font-semibold text-heading">{t(lang, "onbWelcome")}</span>
          </div>
          <button type="button" onClick={() => finish(false)} className="text-xs font-medium text-muted hover:text-heading">
            {t(lang, "onbSkip")}
          </button>
        </div>

        <div className="mb-5 flex gap-1.5" aria-label={`${t(lang, "onbStep")} ${step + 1} / 3`}>
          {[0, 1, 2].map((i) => (
            <span key={i} className={`h-1 flex-1 rounded-full ${i <= step ? "bg-noor-700 dark:bg-gold-300" : "bg-noor-100 dark:bg-noor-800"}`} />
          ))}
        </div>

        {step === 0 && (
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-heading">{t(lang, "onbLangTitle")}</h2>
            <div className="space-y-2 pt-1">
              {LANGS.map((l) => (
                <button key={l.id} type="button" onClick={() => setLang(l.id)} className={choice(lang === l.id)}>
                  {l.label}
                </button>
              ))}
            </div>
          </section>
        )}

        {step === 1 && (
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-heading">{t(lang, "onbLocTitle")}</h2>
            <p className="text-sm text-muted">{t(lang, "onbLocDesc")}</p>
            {salah.coords && !salah.error ? (
              <p className="flex items-center gap-2 rounded-2xl bg-noor-50 px-4 py-3.5 text-sm font-medium text-noor-900 dark:bg-noor-800 dark:text-white">
                <Icon name="check" className="h-4 w-4 text-noor-700 dark:text-gold-300" strokeWidth={2.5} />
                {t(lang, "onbLocSet")}
                {salah.locationLabel ? <span className="truncate font-normal text-muted">· {salah.locationLabel}</span> : null}
              </p>
            ) : (
              <button type="button" onClick={salah.useGpsLocation} className="btn-primary flex w-full items-center justify-center gap-2">
                <Icon name="pin" className="h-4 w-4" />
                {salah.loading ? t(lang, "salahLocating") : t(lang, "onbUseLocation")}
              </button>
            )}
            <p className="text-xs text-faint">{t(lang, "onbLocLater")}</p>
          </section>
        )}

        {step === 2 && (
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-heading">{t(lang, "onbCalcTitle")}</h2>
            <p className="text-sm text-muted">{t(lang, "onbCalcDesc")}</p>
            <label className="block pt-1 text-xs font-medium text-muted">{t(lang, "calcMethod")}</label>
            <select className="input" value={method} onChange={(e) => setMethod(Number(e.target.value))}>
              {PRAYER_METHODS.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
            <label className="block pt-1 text-xs font-medium text-muted">{t(lang, "asrMadhab")}</label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setSchool(1)} className={choice(school === 1)}>Hanafi</button>
              <button type="button" onClick={() => setSchool(0)} className={choice(school === 0)}>Shafi / Maliki / Hanbali</button>
            </div>
          </section>
        )}

        <div className="mt-8 flex items-center gap-3">
          {step > 0 && (
            <button type="button" onClick={() => setStep(step - 1)} className="rounded-xl px-4 py-2.5 text-sm font-medium text-muted hover:text-heading">
              {t(lang, "onbBack")}
            </button>
          )}
          <button
            type="button"
            onClick={() => (step < 2 ? setStep(step + 1) : finish(true))}
            className="btn-primary ms-auto min-w-32"
          >
            {step < 2 ? t(lang, "onbNext") : t(lang, "onbStart")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
