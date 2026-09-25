"use client";

import { LoadingGlass } from "@/components/LoadingGlass";
import { useLang } from "@/components/LangProvider";
import { t } from "@/lib/i18n";

export function PageLoading() {
  const { lang } = useLang();
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <LoadingGlass size="lg" label={t(lang, "loading")} />
    </div>
  );
}
