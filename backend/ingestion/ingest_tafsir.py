#!/usr/bin/env python3
"""
Ingest Tafsir Ibn Kathir (English) and store as source_type='tafsir'
in document_chunks, with embeddings.

Usage:
  cd backend
  source .venv/bin/activate
  python ingestion/ingest_tafsir.py             # all 114 surahs
  python ingestion/ingest_tafsir.py --surah 3   # single surah test

Data source: everyayah.com / quran-tafseer API (Tafsir Ibn Kathir, edition en.ibn-kathir)
No API key required.

Each chunk = one ayah's tafsir, stored as:
  source_ref : "Tafsir Ibn Kathir 2:275"
  content    : "Tafsir Ibn Kathir 2:275\n<tafsir text>"
  metadata   : {"surah": 2, "ayah": 275, "edition": "ibn_kathir"}
  source_type: "tafsir"
"""
import argparse
import sys
import time
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db import get_conn, use_sqlite
from app.services.embedding_service import embed_texts, use_local_embeddings, use_xenova_embeddings
from ingestion.embedding_chunks import insert_chunk

TAFSIR_API = "https://api.qurancdn.com/api/qdc/tafsirs/169/by_ayah/{verse_key}"
AYAH_COUNT = {
    1: 7, 2: 286, 3: 200, 4: 176, 5: 120, 6: 165, 7: 206, 8: 75, 9: 129, 10: 109,
    11: 123, 12: 111, 13: 43, 14: 52, 15: 99, 16: 128, 17: 111, 18: 110, 19: 98, 20: 135,
    21: 112, 22: 78, 23: 118, 24: 64, 25: 77, 26: 227, 27: 93, 28: 88, 29: 69, 30: 60,
    31: 34, 32: 30, 33: 73, 34: 54, 35: 45, 36: 83, 37: 182, 38: 88, 39: 75, 40: 85,
    41: 54, 42: 53, 43: 89, 44: 59, 45: 37, 46: 35, 47: 38, 48: 29, 49: 18, 50: 45,
    51: 60, 52: 49, 53: 62, 54: 55, 55: 78, 56: 96, 57: 29, 58: 22, 59: 24, 60: 13,
    61: 14, 62: 11, 63: 11, 64: 18, 65: 12, 66: 12, 67: 30, 68: 52, 69: 52, 70: 44,
    71: 28, 72: 28, 73: 20, 74: 56, 75: 40, 76: 31, 77: 50, 78: 40, 79: 46, 80: 42,
    81: 29, 82: 19, 83: 36, 84: 25, 85: 22, 86: 17, 87: 19, 88: 26, 89: 30, 90: 20,
    91: 15, 92: 21, 93: 11, 94: 8, 95: 8, 96: 19, 97: 5, 98: 8, 99: 8, 100: 11,
    101: 11, 102: 8, 103: 3, 104: 9, 105: 5, 106: 4, 107: 7, 108: 3, 109: 6, 110: 3,
    111: 5, 112: 4, 113: 5, 114: 6,
}

BATCH = 16


def _already_indexed(cur, is_sqlite) -> set[str]:
    if is_sqlite:
        cur.execute("SELECT source_ref FROM document_chunks WHERE source_type='tafsir'")
    else:
        cur.execute("SELECT source_ref FROM document_chunks WHERE source_type='tafsir'")
    return {row[0] if not isinstance(row, dict) else row["source_ref"] for row in cur.fetchall()}


def fetch_tafsir(verse_key: str, retries: int = 3) -> str | None:
    url = TAFSIR_API.format(verse_key=verse_key)
    for attempt in range(retries):
        try:
            r = requests.get(url, timeout=15)
            if r.status_code == 200:
                data = r.json()
                # QuranCDC returns tafsir_text inside tafsir.text (may contain HTML tags)
                text = (data.get("tafsir") or {}).get("text", "").strip()
                if text:
                    # Strip basic HTML tags
                    import re
                    text = re.sub(r"<[^>]+>", " ", text)
                    text = re.sub(r"\s{2,}", " ", text).strip()
                    return text
            elif r.status_code == 404:
                return None
        except Exception:
            pass
        time.sleep(1 + attempt)
    return None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--surah", type=int, default=0, help="Single surah to ingest (0 = all)")
    parser.add_argument("--resume", action="store_true", default=True, help="Skip already indexed refs")
    args = parser.parse_args()

    is_sqlite = use_sqlite()
    if use_xenova_embeddings():
        provider = "Xenova via /api/embed"
    elif use_local_embeddings():
        provider = "local all-MiniLM-L6-v2"
    else:
        provider = "OpenAI"
    print(f"Tafsir ingestion starting | embed: {provider} | db: {'sqlite' if is_sqlite else 'postgres'}")

    surahs = [args.surah] if args.surah else list(range(1, 115))

    with get_conn() as conn:
        cur = conn.cursor()
        indexed = _already_indexed(cur, is_sqlite)

    print(f"Already indexed: {len(indexed)} tafsir chunks")

    pending: list[tuple[str, str]] = []  # (verse_key, tafsir_text)
    total_fetched = 0
    total_skipped = 0

    for surah in surahs:
        n_ayahs = AYAH_COUNT.get(surah, 0)
        print(f"\nSurah {surah} ({n_ayahs} ayahs)...")
        for ayah in range(1, n_ayahs + 1):
            vk = f"{surah}:{ayah}"
            ref = f"Tafsir Ibn Kathir {vk}"
            if ref in indexed:
                total_skipped += 1
                continue

            text = fetch_tafsir(vk)
            if not text:
                continue

            pending.append((vk, text))
            total_fetched += 1

            if len(pending) >= BATCH:
                _flush(pending, is_sqlite)
                pending.clear()

            time.sleep(0.15)  # be polite to the API

        print(f"  Surah {surah} done. Fetched: {total_fetched}, Skipped: {total_skipped}")

    if pending:
        _flush(pending, is_sqlite)

    print(f"\nDone. Total tafsir chunks ingested: {total_fetched}")


def _flush(pending: list[tuple[str, str]], is_sqlite: bool) -> None:
    texts = [f"Tafsir Ibn Kathir {vk}\n{text}" for vk, text in pending]
    try:
        embeddings = embed_texts(texts)
    except Exception as e:
        print(f"  Embedding error: {e} — skipping batch")
        return

    with get_conn() as conn:
        cur = conn.cursor()
        for (vk, text), emb, full_text in zip(pending, embeddings, texts):
            surah, ayah = vk.split(":")
            metadata = {"surah": int(surah), "ayah": int(ayah), "edition": "ibn_kathir"}
            ref = f"Tafsir Ibn Kathir {vk}"
            insert_chunk(cur, "tafsir", ref, full_text, metadata, emb, is_sqlite)
    print(f"  Flushed {len(pending)} tafsir chunks")


if __name__ == "__main__":
    main()
