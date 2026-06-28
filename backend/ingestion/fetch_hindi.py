#!/usr/bin/env python3
"""Fetch Hindi translation (Farooq Khan & Nadvi) + auto roman transliteration."""
import sys
import time
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db import get_conn, use_sqlite
from app.services.transliteration_hi import hindi_to_roman

BASE = "https://api.alquran.cloud/v1"


def main():
    is_sqlite = use_sqlite()
    print("Fetching Hindi translation (hi.hindi)...")

    with get_conn() as conn:
        cur = conn.cursor()
        for surah in range(1, 115):
            resp = httpx.get(f"{BASE}/surah/{surah}/hi.hindi", timeout=60)
            resp.raise_for_status()
            data = resp.json()["data"]
            if isinstance(data, list):
                ayahs = data[0]["ayahs"] if data else []
            else:
                ayahs = data["ayahs"]

            for ayah in ayahs:
                vk = f"{surah}:{ayah['numberInSurah']}"
                hi = ayah["text"]
                tr_hi = hindi_to_roman(hi)
                if is_sqlite:
                    cur.execute(
                        "UPDATE ayahs SET translation_hi = ?, transliteration_hi = ? WHERE verse_key = ?",
                        (hi, tr_hi, vk),
                    )
                else:
                    cur.execute(
                        "UPDATE ayahs SET translation_hi = %s, transliteration_hi = %s WHERE verse_key = %s",
                        (hi, tr_hi, vk),
                    )
            print(f"  Surah {surah}/114")
            time.sleep(0.1)

    print("Hindi translation + transliteration complete.")


if __name__ == "__main__":
    main()
