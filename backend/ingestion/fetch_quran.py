#!/usr/bin/env python3
"""Fetch full Quran from Al Quran Cloud API (free, no API key required)."""
import sys
import time
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db import get_conn, use_sqlite

EDITIONS = "quran-uthmani,en.sahih,ur.jalandhry,en.transliteration"
BASE = "https://api.alquran.cloud/v1"


def fetch_surah_meta():
    resp = httpx.get(f"{BASE}/surah", timeout=60)
    resp.raise_for_status()
    return resp.json()["data"]


def fetch_surah_editions(number: int) -> dict:
    resp = httpx.get(f"{BASE}/surah/{number}/editions/{EDITIONS}", timeout=60)
    resp.raise_for_status()
    return resp.json()["data"]


def main():
    is_sqlite = use_sqlite()
    print("Fetching Quran metadata...")
    meta_list = fetch_surah_meta()

    with get_conn() as conn:
        cur = conn.cursor()
        if is_sqlite:
            cur.execute("DELETE FROM ayahs")
            cur.execute("DELETE FROM surahs")
        else:
            cur.execute("TRUNCATE ayahs, surahs RESTART IDENTITY CASCADE")

        for meta in meta_list:
            num = meta["number"]
            print(f"  Surah {num}/114 — {meta['englishName']}")
            editions = fetch_surah_editions(num)
            arabic_data = editions[0]
            en_data = editions[1]
            ur_data = editions[2]
            tr_data = editions[3]

            if is_sqlite:
                cur.execute(
                    """
                    INSERT OR REPLACE INTO surahs (number, name_ar, name_en, name_en_translation, revelation_type, ayah_count)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (
                        num, meta["name"], meta["englishName"],
                        meta["englishNameTranslation"], meta["revelationType"], meta["numberOfAyahs"],
                    ),
                )
            else:
                cur.execute(
                    """
                    INSERT INTO surahs (number, name_ar, name_en, name_en_translation, revelation_type, ayah_count)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    ON CONFLICT (number) DO UPDATE SET
                      name_ar = EXCLUDED.name_ar, name_en = EXCLUDED.name_en,
                      name_en_translation = EXCLUDED.name_en_translation,
                      revelation_type = EXCLUDED.revelation_type, ayah_count = EXCLUDED.ayah_count
                    """,
                    (
                        num, meta["name"], meta["englishName"],
                        meta["englishNameTranslation"], meta["revelationType"], meta["numberOfAyahs"],
                    ),
                )

            for i, ayah in enumerate(arabic_data["ayahs"]):
                en_ayah = en_data["ayahs"][i]
                ur_ayah = ur_data["ayahs"][i]
                tr_ayah = tr_data["ayahs"][i]
                verse_key = f"{num}:{ayah['numberInSurah']}"
                if is_sqlite:
                    cur.execute(
                        """
                        INSERT OR REPLACE INTO ayahs (surah_number, ayah_number, verse_key, arabic, transliteration,
                                       translation_en, translation_ur, juz, page)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        (
                            num, ayah["numberInSurah"], verse_key, ayah["text"], tr_ayah["text"],
                            en_ayah["text"], ur_ayah["text"], ayah.get("juz"), ayah.get("page"),
                        ),
                    )
                else:
                    cur.execute(
                        """
                        INSERT INTO ayahs (surah_number, ayah_number, verse_key, arabic, transliteration,
                                           translation_en, translation_ur, juz, page)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (verse_key) DO UPDATE SET
                          arabic = EXCLUDED.arabic, transliteration = EXCLUDED.transliteration,
                          translation_en = EXCLUDED.translation_en, translation_ur = EXCLUDED.translation_ur,
                          juz = EXCLUDED.juz, page = EXCLUDED.page
                        """,
                        (
                            num, ayah["numberInSurah"], verse_key, ayah["text"], tr_ayah["text"],
                            en_ayah["text"], ur_ayah["text"], ayah.get("juz"), ayah.get("page"),
                        ),
                    )
            time.sleep(0.12)

    print("Quran ingestion complete.")


if __name__ == "__main__":
    main()
