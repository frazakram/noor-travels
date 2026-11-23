"use client";

import { useEffect } from "react";
import { useLang } from "@/components/LangProvider";
import { reportError } from "@/lib/error-reporter";
import { NoticeCard } from "@/components/NoticeCard";
import { t } from "@/lib/i18n";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { lang } = useLang();
  useEffect(() => {
    reportError("react", error);
  }, [error]);
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg items-center justify-center px-4">
      <NoticeCard
        tone="error"
        title={t(lang, "genericErrorTitle")}
        message={t(lang, "genericErrorBody")}
        actionLabel={t(lang, "tryAgain")}
        onAction={reset}
      />
    </div>
  );
}
