"use client";

import Link from "next/link";
import { useLang } from "@/components/LangProvider";
import { IBADAH_GROUPS, loc, type IbadahGroup, type Localized } from "@/lib/ibadah";
import { t } from "@/lib/i18n";

const GROUP_KEY = {
  purification: "ibadahGroupPurification",
  prayer: "ibadahGroupPrayer",
  ramadan: "ibadahGroupRamadan",
  hajj: "ibadahGroupHajj",
  life: "ibadahGroupLife",
} as const;

type GuideSummary = {
  slug: string;
  group: IbadahGroup;
  title: Localized;
  summary: Localized;
  status: "draft" | "reviewed";
  steps: number;
};

export function IbadahIndex({ guides }: { guides: GuideSummary[] }) {
  const { lang } = useLang();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-heading">{t(lang, "ibadahGuide")}</h1>
        <p className="text-sm text-muted">{t(lang, "ibadahSubtitle")}</p>
      </div>
      {IBADAH_GROUPS.map((group) => {
        const inGroup = guides.filter((g) => g.group === group);
        if (!inGroup.length) return null;
        return (
          <section key={group} className="space-y-3" aria-labelledby={`group-${group}`}>
            <h2 id={`group-${group}`} className="text-sm font-semibold uppercase tracking-wide text-accent">
              {t(lang, GROUP_KEY[group])}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {inGroup.map((g) => (
                <Link
                  key={g.slug}
                  href={`/ibadah/${g.slug}`}
                  className="card flex flex-col gap-2 transition hover:border-noor-300 hover:shadow-md dark:hover:border-noor-500"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-lg font-semibold text-heading">{loc(g.title, lang)}</h3>
                    {g.steps > 0 && (
                      <span className="shrink-0 rounded-full bg-noor-50 px-2 py-0.5 text-[11px] font-medium text-noor-700 dark:bg-noor-800 dark:text-noor-200">
                        {t(lang, "ibadahSteps").replace("{n}", String(g.steps))}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted">{loc(g.summary, lang)}</p>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
