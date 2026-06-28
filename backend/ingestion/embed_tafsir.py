#!/usr/bin/env python3
"""Embed tafsir (Ibn Kathir, Maududi, PDF pages) for RAG."""
import sqlite3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db import SQLITE_PATH, get_conn, use_sqlite
from app.services.embedding_service import embed_texts, use_local_embeddings
from ingestion.embedding_chunks import insert_chunk

BATCH = 24 if use_local_embeddings() else 40


def rebuild_fts():
    if not use_sqlite():
        return
    conn = sqlite3.connect(SQLITE_PATH)
    conn.execute("DELETE FROM chunks_fts")
    conn.execute(
        """
        INSERT INTO chunks_fts(rowid, source_ref, content, source_type, chunk_id)
        SELECT id, source_ref, content, source_type, id FROM document_chunks
        """
    )
    conn.commit()
    count = conn.execute("SELECT COUNT(*) FROM chunks_fts").fetchone()[0]
    conn.close()
    print(f"FTS rebuilt — {count} chunks indexed.")


def main():
    is_sqlite = use_sqlite()
    provider = "local bge-m3" if use_local_embeddings() else "OpenAI"
    print(f"Embedding provider: {provider}")

    with get_conn() as conn:
        cur = conn.cursor()
        if is_sqlite:
            cur.execute("DELETE FROM document_chunks WHERE source_type = ?", ("tafsir",))
        else:
            cur.execute("DELETE FROM document_chunks WHERE source_type = %s", ("tafsir",))

        cur.execute(
            "SELECT verse_key, source, text FROM tafsir WHERE source IN ('ibn_kathir_en', 'maududi_ur') ORDER BY verse_key"
        )
        rows = cur.fetchall()
        if is_sqlite:
            rows = [tuple(r) for r in rows]

        print(f"Embedding {len(rows)} tafsir ayah entries...")
        for i in range(0, len(rows), BATCH):
            batch = rows[i : i + BATCH]
            texts = [f"Tafsir {r[1]} {r[0]}: {r[2]}" for r in batch]
            embeddings = embed_texts(texts)
            for r, emb, text in zip(batch, embeddings, texts):
                insert_chunk(
                    cur,
                    "tafsir",
                    f"Tafsir {r[0]} ({r[1]})",
                    text,
                    {"verse_key": r[0], "tafsir_source": r[1]},
                    emb,
                    is_sqlite,
                )
            print(f"  Tafsir ayahs {min(i + BATCH, len(rows))}/{len(rows)}", flush=True)

        try:
            cur.execute(
                "SELECT pdf_page, mushaf_page, text FROM tafsir_pdf_pages ORDER BY pdf_page"
            )
            pdf_rows = cur.fetchall()
            if is_sqlite:
                pdf_rows = [tuple(r) for r in pdf_rows]
        except Exception:
            pdf_rows = []

        print(f"Embedding {len(pdf_rows)} Maududi PDF pages...")
        for i in range(0, len(pdf_rows), BATCH):
            batch = pdf_rows[i : i + BATCH]
            texts = [f"Maududi Urdu PDF page {r[0]} (mushaf ~{r[1]}): {r[2]}" for r in batch]
            embeddings = embed_texts(texts)
            for r, emb, text in zip(batch, embeddings, texts):
                insert_chunk(
                    cur,
                    "tafsir",
                    f"Maududi PDF p.{r[0]}",
                    text,
                    {"pdf_page": r[0], "mushaf_page": r[1], "tafsir_source": "maududi_ur_pdf"},
                    emb,
                    is_sqlite,
                )
            print(f"  PDF pages {min(i + BATCH, len(pdf_rows))}/{len(pdf_rows)}", flush=True)

    rebuild_fts()
    print("Tafsir embedding complete.")


if __name__ == "__main__":
    main()
