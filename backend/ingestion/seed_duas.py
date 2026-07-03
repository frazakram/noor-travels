#!/usr/bin/env python3
"""Seed duas from JSON files in data/sources/misc/duas/."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db import get_conn, use_sqlite

DUAS_DIR = Path(__file__).resolve().parents[2] / "data/sources/misc/duas"


def _load_duas() -> list[dict]:
    duas: list[dict] = []
    seen: set[str] = set()
    for path in sorted(DUAS_DIR.glob("*.json")):
        for d in json.loads(path.read_text(encoding="utf-8")):
            if d["id"] in seen:
                continue
            seen.add(d["id"])
            duas.append(d)
    return duas


def main():
    is_sqlite = use_sqlite()
    duas = _load_duas()
    with get_conn() as conn:
        cur = conn.cursor()
        if is_sqlite:
            cur.execute("DELETE FROM document_chunks WHERE source_type = 'dua'")
            cur.execute("DELETE FROM duas")
        else:
            cur.execute("DELETE FROM document_chunks WHERE source_type = 'dua'")
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
                        d["source"], d.get("category", "general"),
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
                        d["source"], d.get("category", "general"),
                    ),
                )
    print(f"Seeded {len(duas)} duas from {DUAS_DIR}.")


if __name__ == "__main__":
    main()
