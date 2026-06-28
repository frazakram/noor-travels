#!/usr/bin/env python3
"""
Ingest Maududi Urdu translation+tafsir from HOCR searchtext + page index.

The scanned PDF OCR is noisy; we map PDF pages to Madani mushaf pages (604)
using a calibrated linear offset, then attach page text to ayahs on that mushaf page.
Clean per-ayah tafsir remains in `tafsir` (source maududi_ur) from Al Quran Cloud.
"""
import gzip
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db import get_conn, use_sqlite

DATA_DIR = Path(__file__).resolve().parents[2] / "data/sources/tafsir/maududi-pdf"
PAGEINDEX = DATA_DIR / "quran-urdu-translation-tafsir_hocr_pageindex.json.gz"
SEARCHTEXT_GZ = DATA_DIR / "quran-urdu-translation-tafsir_hocr_searchtext.txt.gz"
SEARCHTEXT_TXT = DATA_DIR / "quran-urdu-translation-tafsir_hocr_searchtext.txt"

# PDF page where Surah Al-Fatiha content begins (~mushaf page 1)
PDF_QURAN_START = 7
MUSHAF_PAGES = 604


def _load_searchtext() -> str:
    if not SEARCHTEXT_TXT.exists():
        with gzip.open(SEARCHTEXT_GZ, "rt", encoding="utf-8", errors="replace") as f:
            SEARCHTEXT_TXT.write_text(f.read(), encoding="utf-8")
    return SEARCHTEXT_TXT.read_text(encoding="utf-8", errors="replace")


def _clean_page_text(raw: str) -> str:
    text = re.sub(r"\s+", " ", raw).strip()
    return text


def _pdf_pages_for_mushaf(mushaf_page: int, total_pdf_pages: int) -> tuple[int, int]:
    """Return inclusive PDF page range for a mushaf page (1–604)."""
    if mushaf_page < 1:
        mushaf_page = 1
    if mushaf_page > MUSHAF_PAGES:
        mushaf_page = MUSHAF_PAGES
    span = (total_pdf_pages - PDF_QURAN_START) / MUSHAF_PAGES
    start = PDF_QURAN_START + int((mushaf_page - 1) * span)
    end = PDF_QURAN_START + int(mushaf_page * span) - 1
    start = max(1, min(start, total_pdf_pages))
    end = max(start, min(end, total_pdf_pages))
    return start, end


def extract_pdf_pages() -> list[dict]:
    text = _load_searchtext()
    with gzip.open(PAGEINDEX, "rt", encoding="utf-8") as f:
        page_index = json.load(f)

    pages: list[dict] = []
    for i, entry in enumerate(page_index):
        char_start, char_end = entry[0], entry[1]
        if char_end <= char_start:
            continue
        raw = text[char_start:char_end]
        cleaned = _clean_page_text(raw)
        if len(cleaned) < 80:
            continue
        pages.append(
            {
                "pdf_page": i + 1,
                "char_start": char_start,
                "char_end": char_end,
                "text": cleaned,
            }
        )
    return pages


def assign_mushaf_pages(pdf_pages: list[dict]) -> None:
    total = max(p["pdf_page"] for p in pdf_pages) if pdf_pages else 0
    for p in pdf_pages:
        # Nearest mushaf page for this PDF page
        rel = p["pdf_page"] - PDF_QURAN_START
        if rel < 0:
            p["mushaf_page"] = None
        else:
            p["mushaf_page"] = min(MUSHAF_PAGES, max(1, int(rel * MUSHAF_PAGES / max(1, total - PDF_QURAN_START)) + 1))


def ingest_pdf_pages(cur, pdf_pages: list[dict], is_sqlite: bool) -> None:
    if is_sqlite:
        cur.execute("DELETE FROM tafsir_pdf_pages")
    else:
        cur.execute("DELETE FROM tafsir_pdf_pages")

    for p in pdf_pages:
        if is_sqlite:
            cur.execute(
                """
                INSERT OR REPLACE INTO tafsir_pdf_pages
                (pdf_page, mushaf_page, char_start, char_end, text)
                VALUES (?, ?, ?, ?, ?)
                """,
                (p["pdf_page"], p.get("mushaf_page"), p["char_start"], p["char_end"], p["text"]),
            )
        else:
            cur.execute(
                """
                INSERT INTO tafsir_pdf_pages (pdf_page, mushaf_page, char_start, char_end, text)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (pdf_page) DO UPDATE SET
                  mushaf_page = EXCLUDED.mushaf_page,
                  char_start = EXCLUDED.char_start,
                  char_end = EXCLUDED.char_end,
                  text = EXCLUDED.text
                """,
                (p["pdf_page"], p.get("mushaf_page"), p["char_start"], p["char_end"], p["text"]),
            )


def ingest_ayah_pdf_tafsir(cur, pdf_pages: list[dict], is_sqlite: bool) -> int:
    """Store OCR page text per ayah (split by ayah count on mushaf page)."""
    by_pdf = {p["pdf_page"]: p["text"] for p in pdf_pages}
    total_pdf = max(by_pdf) if by_pdf else 0

    cur.execute("SELECT verse_key, page FROM ayahs ORDER BY surah_number, ayah_number")
    rows = cur.fetchall()
    if is_sqlite:
        rows = [dict(zip(["verse_key", "page"], r)) for r in rows]
    else:
        rows = [dict(r) for r in rows]

    by_mushaf: dict[int, list[str]] = defaultdict(list)
    for r in rows:
        if r["page"]:
            by_mushaf[int(r["page"])].append(r["verse_key"])

    # Build mushaf page -> concatenated PDF text
    mushaf_text: dict[int, str] = {}
    for mushaf_page in range(1, MUSHAF_PAGES + 1):
        p_start, p_end = _pdf_pages_for_mushaf(mushaf_page, total_pdf)
        chunks = [by_pdf.get(n, "") for n in range(p_start, p_end + 1)]
        joined = _clean_page_text(" ".join(c for c in chunks if c))
        if joined:
            mushaf_text[mushaf_page] = joined

    if is_sqlite:
        cur.execute("DELETE FROM tafsir WHERE source = ?", ("maududi_ur_pdf",))
    else:
        cur.execute("DELETE FROM tafsir WHERE source = %s", ("maududi_ur_pdf",))

    count = 0
    for mushaf_page, verse_keys in by_mushaf.items():
        page_text = mushaf_text.get(mushaf_page)
        if not page_text:
            continue
        n = len(verse_keys)
        chunk_size = max(1, len(page_text) // n)
        for i, vk in enumerate(verse_keys):
            start = i * chunk_size
            end = (i + 1) * chunk_size if i < n - 1 else len(page_text)
            snippet = page_text[start:end].strip()
            if len(snippet) < 40:
                snippet = page_text[: min(4000, len(page_text))]
            if is_sqlite:
                cur.execute(
                    "INSERT OR REPLACE INTO tafsir (verse_key, source, text) VALUES (?,?,?)",
                    (vk, "maududi_ur_pdf", snippet),
                )
            else:
                cur.execute(
                    """
                    INSERT INTO tafsir (verse_key, source, text) VALUES (%s,%s,%s)
                    ON CONFLICT (verse_key, source) DO UPDATE SET text = EXCLUDED.text
                    """,
                    (vk, "maududi_ur_pdf", snippet),
                )
            count += 1
    return count


def apply_migration(conn, is_sqlite: bool) -> None:
    sql_path = (
        Path(__file__).resolve().parents[1] / "migrations/004_maududi_pdf_sqlite.sql"
        if is_sqlite
        else Path(__file__).resolve().parents[1] / "migrations/004_maududi_pdf.sql"
    )
    if is_sqlite:
        conn.executescript(sql_path.read_text())
    else:
        with conn.cursor() as cur:
            cur.execute(sql_path.read_text())


def main():
    if not PAGEINDEX.exists() or not SEARCHTEXT_GZ.exists():
        raise SystemExit(f"Missing HOCR files in {DATA_DIR}")

    is_sqlite = use_sqlite()
    print("Extracting PDF page text from HOCR...")
    pdf_pages = extract_pdf_pages()
    assign_mushaf_pages(pdf_pages)
    print(f"  {len(pdf_pages)} pages with usable text")

    with get_conn() as conn:
        apply_migration(conn, is_sqlite)
        cur = conn.cursor()
        ingest_pdf_pages(cur, pdf_pages, is_sqlite)
        n_ayah = ingest_ayah_pdf_tafsir(cur, pdf_pages, is_sqlite)
        print(f"Ingested {len(pdf_pages)} PDF pages, {n_ayah} ayah-level OCR tafsir rows (maududi_ur_pdf)")

    print("Maududi PDF ingestion complete.")


if __name__ == "__main__":
    main()
