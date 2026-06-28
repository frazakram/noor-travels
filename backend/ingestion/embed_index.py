#!/usr/bin/env python3
"""Build RAG embeddings for Quran ayahs, hadiths, and duas."""
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db import get_conn, use_sqlite
from app.services.embedding_service import embed_texts, use_local_embeddings
from ingestion.embedding_chunks import insert_chunk

BATCH = 32 if use_local_embeddings() else 50


def _insert_batch(cur, rows, source_type, ref_fn, text_fn, meta_fn, is_sqlite) -> None:
    texts = [text_fn(r) for r in rows]
    embeddings = embed_texts(texts)
    for row, emb, text in zip(rows, embeddings, texts):
        insert_chunk(cur, source_type, ref_fn(row), text, meta_fn(row), emb, is_sqlite)


def main():
    is_sqlite = use_sqlite()
    provider = "local bge-m3" if use_local_embeddings() else "OpenAI"
    print(f"Embedding provider: {provider}")

    with get_conn() as conn:
        cur = conn.cursor()
        if is_sqlite:
            cur.execute("DELETE FROM document_chunks")
        else:
            cur.execute("TRUNCATE document_chunks RESTART IDENTITY CASCADE")

    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT verse_key, arabic, transliteration, translation_en, translation_ur
            FROM ayahs ORDER BY surah_number, ayah_number
            """
        )
        ayahs = cur.fetchall()
        if is_sqlite:
            ayahs = [tuple(a) for a in ayahs]

    print(f"Embedding {len(ayahs)} ayahs...")
    for i in range(0, len(ayahs), BATCH):
        batch = ayahs[i : i + BATCH]
        with get_conn() as conn:
            cur = conn.cursor()
            _insert_batch(
                cur,
                batch,
                "quran",
                lambda a: f"Quran {a[0]}",
                lambda a: (
                    f"Quran {a[0]}. Arabic: {a[1]}. Transliteration: {a[2]}. "
                    f"English: {a[3]}. Urdu: {a[4]}"
                ),
                lambda a: {"verse_key": a[0]},
                is_sqlite,
            )
        print(f"  Ayahs {min(i + BATCH, len(ayahs))}/{len(ayahs)}", flush=True)
        if not use_local_embeddings():
            time.sleep(0.2)

    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute("SELECT id, reference, chapter_en, arabic, english FROM hadiths ORDER BY id")
        hadiths = cur.fetchall()
        if is_sqlite:
            hadiths = [tuple(h) for h in hadiths]

    print(f"Embedding {len(hadiths)} hadiths (sampling 800 for speed)...")
    sample = hadiths[:800]
    for i in range(0, len(sample), BATCH):
        batch = sample[i : i + BATCH]
        with get_conn() as conn:
            cur = conn.cursor()
            _insert_batch(
                cur,
                batch,
                "hadith",
                lambda h: h[1],
                lambda h: f"{h[1]}. Chapter: {h[2]}. Arabic: {h[3]}. English: {h[4]}",
                lambda h: {"hadith_id": h[0]},
                is_sqlite,
            )
        print(f"  Hadiths {min(i + BATCH, len(sample))}/{len(sample)}", flush=True)
        if not use_local_embeddings():
            time.sleep(0.2)

    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT id, title_en, arabic, transliteration, translation_en, translation_ur, source FROM duas"
        )
        duas = cur.fetchall()
        if is_sqlite:
            duas = [tuple(d) for d in duas]

    print(f"Embedding {len(duas)} duas...")
    with get_conn() as conn:
        cur = conn.cursor()
        _insert_batch(
            cur,
            duas,
            "dua",
            lambda d: f"Dua {d[0]}",
            lambda d: (
                f"Dua {d[0]}: {d[1]}. Arabic: {d[2]}. Transliteration: {d[3]}. "
                f"English: {d[4]}. Urdu: {d[5]}. Source: {d[6]}"
            ),
            lambda d: {"dua_id": d[0]},
            is_sqlite,
        )

    print("Embedding index complete. Run: python ingestion/setup_fts.py")


if __name__ == "__main__":
    main()
