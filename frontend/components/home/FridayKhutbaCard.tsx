"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLang } from "@/components/LangProvider";
import { t } from "@/lib/i18n";

/** Only on Fridays: the day the live khutba feature is actually needed. */
export function FridayKhutbaCard({ timeZone }: { timeZone: string }) {
  const { lang } = useLang();
  const [isFriday, setIsFriday] = useState(false);

  useEffect(() => {
    const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone }).format(new Date());
    setIsFriday(weekday === "Fri");
  }, [timeZone]);

  if (!isFriday) return null;

  return (
    <section className="card flex items-center justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-heading">{t(lang, "fridayKhutbaTitle")}</h2>
        <p className="mt-0.5 text-sm text-muted">{t(lang, "fridayKhutbaDesc")}</p>
      </div>
      <Link href="/khutba" prefetch={false} className="btn-primary shrink-0 px-4 py-2 text-sm">
        {t(lang, "fridayKhutbaCta")}
      </Link>
    </section>
  );
}
