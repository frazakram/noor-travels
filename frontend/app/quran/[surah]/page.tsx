"use client";

import { Suspense } from "react";
import { useLang } from "@/components/LangProvider";
import { t } from "@/lib/i18n";
import SurahClient from "./SurahClient";

function SurahFallback() {
  const { lang } = useLang();
  return <p className="text-muted">{t(lang, "loading")}…</p>;
}

export default function SurahPage() {
  return (
    <Suspense fallback={<SurahFallback />}>
      <SurahClient />
    </Suspense>
  );
}
