"use client";

import { useLang } from "@/components/LangProvider";
import { t } from "@/lib/i18n";

const CONTACT_EMAIL = "frazakram19@gmail.com";

const SECTIONS = [
  ["privacyDeviceT", "privacyDeviceB"],
  ["privacyLocationT", "privacyLocationB"],
  ["privacyAskT", "privacyAskB"],
  ["privacyAudioT", "privacyAudioB"],
  ["privacyOtherT", "privacyOtherB"],
  ["privacyAccountT", "privacyAccountB"],
  ["privacySecurityT", "privacySecurityB"],
] as const;

export default function PrivacyPage() {
  const { lang } = useLang();
  const dir = lang === "ur" ? "rtl" : "ltr";

  return (
    <article className="mx-auto max-w-2xl space-y-6 pb-10" dir={dir}>
      <header>
        <h1 className="text-2xl font-bold text-heading">{t(lang, "privacyTitle")}</h1>
        <p className="mt-1 text-xs text-faint">{t(lang, "privacyUpdated")}</p>
      </header>
      <p className="text-sm leading-relaxed text-body">{t(lang, "privacyIntro")}</p>
      {SECTIONS.map(([title, body]) => (
        <section key={title} className="space-y-1.5">
          <h2 className="text-base font-semibold text-heading">{t(lang, title)}</h2>
          <p className="text-sm leading-relaxed text-body">{t(lang, body)}</p>
        </section>
      ))}
      <section className="space-y-1.5">
        <h2 className="text-base font-semibold text-heading">{t(lang, "privacyContactT")}</h2>
        <p className="text-sm leading-relaxed text-body">
          {t(lang, "privacyContactB")}{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-accent underline" dir="ltr">
            {CONTACT_EMAIL}
          </a>
        </p>
      </section>
    </article>
  );
}
