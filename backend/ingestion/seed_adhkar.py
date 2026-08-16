#!/usr/bin/env python3
"""Seed adhkar (morning/evening/night) from data/sources/misc/adhkar/.

Content follows Hisn al-Muslim / authentic Sunnah. Items that are exact Quran
verses carry `verse_keys` instead of arabic/transliteration/translation text
in the JSON — this script resolves those from the already-verified `ayahs`
table so Quran text is never retyped.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from psycopg2.extras import RealDictCursor

from app.db import get_conn, use_sqlite

ADHKAR_DIR = Path(__file__).resolve().parents[2] / "data/sources/misc/adhkar"


def _load_items() -> list[dict]:
    items: list[dict] = []
    seen: set[str] = set()
    for path in sorted(ADHKAR_DIR.glob("*.json")):
        for d in json.loads(path.read_text(encoding="utf-8")):
            if d["id"] in seen:
                continue
            seen.add(d["id"])
            items.append(d)
    return items


def _fetch_ayah(cur, is_sqlite: bool, verse_key: str) -> dict:
    q = "SELECT arabic, transliteration, translation_en, translation_ur, translation_hi FROM ayahs WHERE verse_key = %s"
    cur.execute(q if not is_sqlite else q.replace("%s", "?"), (verse_key,))
    row = cur.fetchone()
    if row is None:
        raise RuntimeError(f"verse_key {verse_key!r} not found in ayahs table")
    return dict(row) if is_sqlite else row


def _resolve_verse_text(cur, is_sqlite: bool, verse_keys: str) -> dict:
    keys = [k.strip() for k in verse_keys.split(",") if k.strip()]
    rows = [_fetch_ayah(cur, is_sqlite, k) for k in keys]
    return {
        "arabic": " ".join(r["arabic"] for r in rows),
        "transliteration": " ".join(r["transliteration"] for r in rows),
        "translation_en": " ".join(r["translation_en"] for r in rows),
        "translation_ur": " ".join(r["translation_ur"] for r in rows),
        "translation_hi": " ".join(r["translation_hi"] for r in rows),
    }


def main():
    is_sqlite = use_sqlite()
    items = _load_items()
    with get_conn() as conn:
        cur = conn.cursor()
        select_cur = cur if is_sqlite else conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("DELETE FROM adhkar")

        for d in items:
            verse_keys = d.get("verse_keys")
            if verse_keys:
                text = _resolve_verse_text(select_cur, is_sqlite, verse_keys)
            else:
                text = {
                    "arabic": d["arabic"],
                    "transliteration": d["transliteration"],
                    "translation_en": d["translation_en"],
                    "translation_ur": d["translation_ur"],
                    "translation_hi": d["translation_hi"],
                }

            params = (
                d["id"], d["category"], d["order_index"],
                d["title_en"], d["title_ur"], d["title_hi"],
                text["arabic"], text["transliteration"],
                text["translation_en"], text["translation_ur"], text["translation_hi"],
                d["source"], d.get("repeat_count", 1), verse_keys,
            )
            if is_sqlite:
                cur.execute(
                    """
                    INSERT INTO adhkar (id, category, order_index, title_en, title_ur, title_hi,
                                        arabic, transliteration, translation_en, translation_ur, translation_hi,
                                        source, repeat_count, verse_keys)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                    """,
                    params,
                )
            else:
                cur.execute(
                    """
                    INSERT INTO adhkar (id, category, order_index, title_en, title_ur, title_hi,
                                        arabic, transliteration, translation_en, translation_ur, translation_hi,
                                        source, repeat_count, verse_keys)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    """,
                    params,
                )
    print(f"Seeded {len(items)} adhkar items from {ADHKAR_DIR}.")


if __name__ == "__main__":
    main()
