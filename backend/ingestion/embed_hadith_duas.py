#!/usr/bin/env python3
"""Resume embedding for hadiths and duas only."""
import json
import sys
import time
from pathlib import Path

from openai import OpenAI

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import get_settings
from app.db import get_conn, use_sqlite

BATCH = 30
MAX_EMBED_CHARS = 6000


def _truncate(text: str) -> str:
    return text[:MAX_EMBED_CHARS] if len(text) > MAX_EMBED_CHARS else text


def embed_batch(client, texts):
    settings = get_settings()
    safe = [_truncate(t) for t in texts]
    resp = client.embeddings.create(model=settings.embedding_model, input=safe)
    return [item.embedding for item in resp.data]


def insert_chunk(cur, source_type, source_ref, content, metadata, embedding, is_sqlite):
    if is_sqlite:
        cur.execute(
            "INSERT INTO document_chunks (source_type, source_ref, content, metadata, embedding) VALUES (?,?,?,?,?)",
            (source_type, source_ref, content, json.dumps(metadata), json.dumps(embedding)),
        )
    else:
        emb_str = "[" + ",".join(str(x) for x in embedding) + "]"
        cur.execute(
            "INSERT INTO document_chunks (source_type, source_ref, content, metadata, embedding) VALUES (%s,%s,%s,%s,%s::vector)",
            (source_type, source_ref, content, json.dumps(metadata), emb_str),
        )


def main():
    settings = get_settings()
    client = OpenAI(api_key=settings.openai_api_key)
    is_sqlite = use_sqlite()

    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute("SELECT id, reference, chapter_en, arabic, english FROM hadiths ORDER BY id LIMIT 800")
        hadiths = [tuple(h) for h in cur.fetchall()] if is_sqlite else cur.fetchall()

        print(f"Embedding {len(hadiths)} hadiths...")
        for i in range(0, len(hadiths), BATCH):
            batch = hadiths[i : i + BATCH]
            texts = [f"{h[1]}. Chapter: {h[2]}. English: {h[4][:2000]}" for h in batch]
            embeddings = embed_batch(client, texts)
            for h, emb, text in zip(batch, embeddings, texts):
                insert_chunk(cur, "hadith", h[1], text, {"hadith_id": h[0]}, emb, is_sqlite)
            print(f"  Hadiths {min(i+BATCH,len(hadiths))}/{len(hadiths)}")
            time.sleep(0.2)

        cur.execute("SELECT id, title_en, arabic, transliteration, translation_en, translation_ur, source FROM duas")
        duas = [tuple(d) for d in cur.fetchall()] if is_sqlite else cur.fetchall()
        texts = [f"Dua {d[0]}: {d[1]}. Arabic: {d[2]}. English: {d[4]}. Urdu: {d[5]}." for d in duas]
        embeddings = embed_batch(client, texts)
        for d, emb, text in zip(duas, embeddings, texts):
            insert_chunk(cur, "dua", f"Dua {d[0]}", text, {"dua_id": d[0]}, emb, is_sqlite)

    print("Hadith + dua embeddings complete.")


if __name__ == "__main__":
    main()
