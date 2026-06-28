#!/usr/bin/env python3
"""
Download & ingest:
- Ibn Kathir (English) from spa5k/tafsir_api CDN
- Maududi (Urdu Tafheem) from Al Quran Cloud ur.maududi
"""
import html
import re
import sys
import time
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db import get_conn, use_sqlite

IBN_KATHIR_SLUG = "en-tafisr-ibn-kathir"
CDN = "https://cdn.jsdelivr.net/gh/spa5k/tafsir_api@main/tafsir"
ALQURAN = "https://api.alquran.cloud/v1"
OUT_DIR = Path(__file__).resolve().parents[2] / "data/sources/tafsir"


def _strip_html(text: str) -> str:
    text = re.sub(r"<[^>]+>", " ", text)
    return html.unescape(re.sub(r"\s+", " ", text)).strip()


def download_ibn_kathir():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    dest = OUT_DIR / "ibn_kathir_en"
    dest.mkdir(exist_ok=True)
    client = httpx.Client(timeout=90)
    for surah in range(1, 115):
        path = dest / f"{surah}.json"
        if not path.exists():
            r = client.get(f"{CDN}/{IBN_KATHIR_SLUG}/{surah}.json")
            r.raise_for_status()
            path.write_bytes(r.content)
            time.sleep(0.15)
        print(f"  Ibn Kathir surah {surah}/114 cached")
    client.close()


def ingest_ibn_kathir():
    import json

    is_sqlite = use_sqlite()
    base = OUT_DIR / "ibn_kathir_en"
    with get_conn() as conn:
        cur = conn.cursor()
        if is_sqlite:
            cur.execute("DELETE FROM tafsir WHERE source = ?", ("ibn_kathir_en",))
        else:
            cur.execute("DELETE FROM tafsir WHERE source = %s", ("ibn_kathir_en",))

        for surah in range(1, 115):
            items = json.loads((base / f"{surah}.json").read_text(encoding="utf-8"))
            for item in items:
                ayah_num = item.get("ayah") or item.get("ayah_number")
                if ayah_num is None:
                    continue
                vk = f"{surah}:{ayah_num}"
                text = _strip_html(item.get("text", ""))
                if not text:
                    continue
                if is_sqlite:
                    cur.execute(
                        "INSERT OR REPLACE INTO tafsir (verse_key, source, text) VALUES (?,?,?)",
                        (vk, "ibn_kathir_en", text),
                    )
                else:
                    cur.execute(
                        """
                        INSERT INTO tafsir (verse_key, source, text) VALUES (%s,%s,%s)
                        ON CONFLICT (verse_key, source) DO UPDATE SET text = EXCLUDED.text
                        """,
                        (vk, "ibn_kathir_en", text),
                    )
        print(f"Ingested Ibn Kathir from {base}")


def ingest_maududi_ur():
    is_sqlite = use_sqlite()
    client = httpx.Client(timeout=60)
    with get_conn() as conn:
        cur = conn.cursor()
        if is_sqlite:
            cur.execute("DELETE FROM tafsir WHERE source = ?", ("maududi_ur",))
        else:
            cur.execute("DELETE FROM tafsir WHERE source = %s", ("maududi_ur",))

        for surah in range(1, 115):
            r = client.get(f"{ALQURAN}/surah/{surah}/ur.maududi")
            r.raise_for_status()
            payload = r.json()["data"]
            ayahs = payload["ayahs"] if isinstance(payload, dict) else payload[0]["ayahs"]
            for ayah in ayahs:
                vk = f"{surah}:{ayah['numberInSurah']}"
                text = ayah["text"].strip()
                if is_sqlite:
                    cur.execute(
                        "INSERT OR REPLACE INTO tafsir (verse_key, source, text) VALUES (?,?,?)",
                        (vk, "maududi_ur", text),
                    )
                else:
                    cur.execute(
                        """
                        INSERT INTO tafsir (verse_key, source, text) VALUES (%s,%s,%s)
                        ON CONFLICT (verse_key, source) DO UPDATE SET text = EXCLUDED.text
                        """,
                        (vk, "maududi_ur", text),
                    )
            print(f"  Maududi Urdu surah {surah}/114")
            time.sleep(0.12)
    client.close()


def main():
    print("Downloading Ibn Kathir (English)...")
    download_ibn_kathir()
    print("Ingesting Ibn Kathir...")
    ingest_ibn_kathir()
    print("Ingesting Maududi Urdu (Tafheem via Al Quran Cloud)...")
    ingest_maududi_ur()
    print("Tafsir ingestion complete.")


if __name__ == "__main__":
    main()
