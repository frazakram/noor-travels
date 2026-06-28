#!/usr/bin/env python3
"""Load Sahih al-Bukhari from local JSON."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db import get_conn, use_sqlite

DATA_PATH = Path(__file__).resolve().parents[2] / "data/sources/hadith/bukhari/bukhari.json"


def main():
    if not DATA_PATH.exists():
        raise FileNotFoundError(f"Missing {DATA_PATH}")

    is_sqlite = use_sqlite()
    print(f"Loading Bukhari from {DATA_PATH}...")
    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))

    chapters = {c["id"]: c["english"] for c in data.get("chapters", [])}
    hadiths = data.get("hadiths", [])

    with get_conn() as conn:
        cur = conn.cursor()
        if is_sqlite:
            cur.execute("DELETE FROM hadiths")
        else:
            cur.execute("TRUNCATE hadiths RESTART IDENTITY CASCADE")

        for h in hadiths:
            chapter_id = h.get("chapterId")
            chapter_en = chapters.get(chapter_id, "")
            english = h.get("english", {})
            if isinstance(english, dict):
                narrator = english.get("narrator", "")
                text = english.get("text", "")
                english_text = f"{narrator} {text}".strip()
            else:
                english_text = str(english)

            if is_sqlite:
                cur.execute(
                    """
                    INSERT INTO hadiths (collection, chapter_id, chapter_en, hadith_number, arabic, english, reference)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        "bukhari", chapter_id, chapter_en,
                        h.get("idInBook") or h.get("id"),
                        h.get("arabic", ""), english_text,
                        f"Sahih al-Bukhari {h.get('idInBook') or h.get('id')}",
                    ),
                )
            else:
                cur.execute(
                    """
                    INSERT INTO hadiths (collection, chapter_id, chapter_en, hadith_number, arabic, english, reference)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        "bukhari", chapter_id, chapter_en,
                        h.get("idInBook") or h.get("id"),
                        h.get("arabic", ""), english_text,
                        f"Sahih al-Bukhari {h.get('idInBook') or h.get('id')}",
                    ),
                )

    print(f"Bukhari ingestion complete — {len(hadiths)} hadiths.")


if __name__ == "__main__":
    main()
