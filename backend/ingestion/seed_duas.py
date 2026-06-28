#!/usr/bin/env python3
"""Seed travel duas from JSON file."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db import get_conn, use_sqlite

DUAS_PATH = Path(__file__).resolve().parents[2] / "data/sources/misc/duas/travel-duas.json"


def main():
    is_sqlite = use_sqlite()
    duas = json.loads(DUAS_PATH.read_text(encoding="utf-8"))
    with get_conn() as conn:
        cur = conn.cursor()
        if is_sqlite:
            cur.execute("DELETE FROM duas")
        else:
            cur.execute("TRUNCATE duas")

        for d in duas:
            if is_sqlite:
                cur.execute(
                    """
                    INSERT INTO duas (id, title_en, title_ur, title_hi, arabic, transliteration,
                                      translation_en, translation_ur, translation_hi, source, category)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?)
                    """,
                    (
                        d["id"], d["title_en"], d["title_ur"], d["title_hi"],
                        d["arabic"], d["transliteration"],
                        d["translation_en"], d["translation_ur"], d["translation_hi"],
                        d["source"], d.get("category", "travel"),
                    ),
                )
            else:
                cur.execute(
                    """
                    INSERT INTO duas (id, title_en, title_ur, title_hi, arabic, transliteration,
                                      translation_en, translation_ur, translation_hi, source, category)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    """,
                    (
                        d["id"], d["title_en"], d["title_ur"], d["title_hi"],
                        d["arabic"], d["transliteration"],
                        d["translation_en"], d["translation_ur"], d["translation_hi"],
                        d["source"], d.get("category", "travel"),
                    ),
                )
    print(f"Seeded {len(duas)} duas.")


if __name__ == "__main__":
    main()
