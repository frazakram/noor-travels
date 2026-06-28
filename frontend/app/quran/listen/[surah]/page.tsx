"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { QuranAudiobookPlayer } from "@/components/QuranAudiobookPlayer";
import { useLang } from "@/components/LangProvider";
import { api } from "@/lib/api";
import { t } from "@/lib/i18n";

export default function ListenSurahPage() {
  const params = useParams();
  const surahNumber = Number(params.surah);
  const { lang } = useLang();
  const [surahName, setSurahName] = useState("");

  useEffect(() => {
    api<{ surah: { name_en: string } }>(`/api/quran/surahs/${surahNumber}?translation=en`).then(
      (d) => setSurahName(d.surah.name_en)
    );
  }, [surahNumber]);

  return (
    <div className="space-y-4">
      <Link href="/quran/listen" className="text-sm text-noor-600 hover:text-noor-800">
        ← {t(lang, "audiobook")}
      </Link>
      <QuranAudiobookPlayer surahNumber={surahNumber} surahName={surahName} />
    </div>
  );
}
