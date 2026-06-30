#!/usr/bin/env python3
"""Resume embedding for hadiths and duas only (does not touch existing ayah chunks)."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import get_settings
from app.db import get_conn, use_sqlite
from app.services.embedding_service import embed_texts, use_local_embeddings
from ingestion.embedding_chunks import insert_chunk


def _val(row, key_or_idx, fallback_idx: int | None = None):
    if isinstance(row, dict):
        return row[key_or_idx]
    return row[fallback_idx if fallback_idx is not None else key_or_idx]


def _insert_batches(cur, rows, source_type, ref_fn, text_fn, meta_fn, is_sqlite, batch_size: int) -> None:
    for i in range(0, len(rows), batch_size):
        batch = rows[i : i + batch_size]
        texts = [text_fn(r) for r in batch]
        embeddings = embed_texts(texts)
        for row, emb, text in zip(batch, embeddings, texts):
            insert_chunk(cur, source_type, ref_fn(row), text, meta_fn(row), emb, is_sqlite)
        print(f"  {source_type} {min(i + batch_size, len(rows))}/{len(rows)}", flush=True)


def main():
    settings = get_settings()
    is_sqlite = use_sqlite()
    batch_size = 1 if use_local_embeddings() else max(1, min(settings.embedding_batch_size, 50))
    provider = "local bge-m3" if use_local_embeddings() else "OpenAI"
    print(f"Resume embeddings — provider: {provider}, batch: {batch_size}")

    hadith_sql = """
        SELECT h.id, h.reference, h.chapter_en, h.arabic, h.english
        FROM hadiths h
        WHERE NOT EXISTS (
            SELECT 1 FROM document_chunks dc
            WHERE dc.source_type = 'hadith' AND dc.source_ref = h.reference
        )
        ORDER BY h.id LIMIT 800
    """
    dua_sql_pg = """
        SELECT d.id, d.title_en, d.arabic, d.transliteration, d.translation_en, d.translation_ur, d.source
        FROM duas d
        WHERE NOT EXISTS (
            SELECT 1 FROM document_chunks dc
            WHERE dc.source_type = 'dua' AND dc.source_ref = 'Dua ' || d.id::text
        )
    """
    dua_sql_sqlite = """
        SELECT d.id, d.title_en, d.arabic, d.transliteration, d.translation_en, d.translation_ur, d.source
        FROM duas d
        WHERE NOT EXISTS (
            SELECT 1 FROM document_chunks dc
            WHERE dc.source_type = 'dua' AND dc.source_ref = 'Dua ' || d.id
        )
    """
    dua_sql = dua_sql_sqlite if is_sqlite else dua_sql_pg

    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT COUNT(*) FROM document_chunks WHERE source_type IN ('hadith', 'dua')"
        )
        row = cur.fetchone()
        existing = row[0] if is_sqlite else (row[0] if not isinstance(row, dict) else list(row.values())[0])

    if existing > 0:
        print(f"Resuming — {existing} hadith/dua chunks already embedded.")

    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(hadith_sql)
        hadiths = cur.fetchall()
        if is_sqlite:
            hadiths = [tuple(h) for h in hadiths]

    if hadiths:
        print(f"Embedding {len(hadiths)} hadiths...")
        with get_conn() as conn:
            cur = conn.cursor()
            _insert_batches(
                cur,
                hadiths,
                "hadith",
                lambda h: _val(h, "reference", 1),
                lambda h: (
                    f"{_val(h, 'reference', 1)}. Chapter: {_val(h, 'chapter_en', 2)}. "
                    f"Arabic: {_val(h, 'arabic', 3)}. English: {str(_val(h, 'english', 4))[:1200]}"
                ),
                lambda h: {"hadith_id": _val(h, "id", 0)},
                is_sqlite,
                batch_size,
            )
    elif existing >= 806:
        print("Hadith + dua embeddings already complete.")
        return
    else:
        print("No hadiths left to embed.")

    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(dua_sql)
        duas = cur.fetchall()
        if is_sqlite:
            duas = [tuple(d) for d in duas]

    if not duas:
        print("Duas already embedded.")
        print("Hadith + dua embeddings complete.")
        return

    print(f"Embedding {len(duas)} duas...")
    with get_conn() as conn:
        cur = conn.cursor()
        _insert_batches(
            cur,
            duas,
            "dua",
            lambda d: f"Dua {_val(d, 'id', 0)}",
            lambda d: (
                f"Dua {_val(d, 'id', 0)}: {_val(d, 'title_en', 1)}. "
                f"Arabic: {_val(d, 'arabic', 2)}. Transliteration: {_val(d, 'transliteration', 3)}. "
                f"English: {_val(d, 'translation_en', 4)}. Urdu: {_val(d, 'translation_ur', 5)}. "
                f"Source: {_val(d, 'source', 6)}"
            ),
            lambda d: {"dua_id": _val(d, "id", 0)},
            is_sqlite,
            batch_size,
        )

    print("Hadith + dua embeddings complete.")


if __name__ == "__main__":
    main()
