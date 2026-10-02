#!/usr/bin/env python3
"""Build semantic-search vectors for Quran ayahs, hadiths and duas.

Each source gets one row in document_chunks, tagged with the embedding model that produced it
(metadata.embed_model = Settings.semantic_model). Search only reads rows with the current tag,
so this script can rebuild the index for a new model while the old rows keep serving: each
source's row is replaced in place, and a rerun skips sources already done (resumable).

Run it against the same /api/embed route production uses, so stored and query vectors come
from one model. A local `npm run dev` serves the identical route and is much faster:

    cd backend && EMBEDDING_PROVIDER=xenova EMBED_API_URL=http://localhost:3001/api/embed \\
      FORCE_SQLITE= .venv/bin/python ingestion/embed_index.py
"""
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import get_settings
from app.db import get_conn, use_sqlite
from app.services.embedding_service import embed_texts
from ingestion.embedding_chunks import insert_chunk

BATCH = 32
RETRY_DELAYS_S = (5, 20, 60)


def _embed_with_retry(texts: list[str]) -> list[list[float]]:
    """A long ingestion run must survive the odd slow or failed embedding call."""
    for attempt, delay in enumerate((*RETRY_DELAYS_S, None)):
        try:
            return embed_texts(texts, kind="passage")
        except Exception as exc:
            if delay is None:
                raise
            print(f"    embed failed ({type(exc).__name__}), retry {attempt + 1} in {delay}s", flush=True)
            time.sleep(delay)
    raise RuntimeError("unreachable")


def _done_refs(model: str, is_sqlite: bool) -> set[str]:
    tag = "json_extract(metadata, '$.embed_model')" if is_sqlite else "metadata->>'embed_model'"
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(f"SELECT source_ref FROM document_chunks WHERE {tag} = {'?' if is_sqlite else '%s'}", (model,))
        return {r[0] if not isinstance(r, dict) else r["source_ref"] for r in cur.fetchall()}


def _index(items: list[dict], source_type: str, model: str, done: set[str], is_sqlite: bool) -> None:
    """items: {"ref", "embed" (text the vector is built from), "content" (text shown/used later), "meta"}."""
    todo = [it for it in items if it["ref"] not in done]
    print(f"{source_type}: {len(items) - len(todo)} already embedded by {model}, {len(todo)} to go", flush=True)
    mark = "?" if is_sqlite else "%s"
    for i in range(0, len(todo), BATCH):
        batch = todo[i : i + BATCH]
        vectors = _embed_with_retry([it["embed"] for it in batch])
        with get_conn() as conn:  # one transaction per batch: a source is never left without a row
            cur = conn.cursor()
            for it, vector in zip(batch, vectors):
                cur.execute(f"DELETE FROM document_chunks WHERE source_ref = {mark}", (it["ref"],))
                insert_chunk(cur, source_type, it["ref"], it["content"], {**it["meta"], "embed_model": model}, vector, is_sqlite)
        print(f"  {source_type} {min(i + BATCH, len(todo))}/{len(todo)}", flush=True)


def _rows(sql: str) -> list[tuple]:
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(sql)
        return [tuple(r.values()) if isinstance(r, dict) else tuple(r) for r in cur.fetchall()]


def main() -> None:
    is_sqlite = use_sqlite()
    model = get_settings().semantic_model
    print(f"Embedding model: {model} via {get_settings().embed_url}")
    done = _done_refs(model, is_sqlite)

    # The vector is built from the English translation only: Arabic and Urdu script in the
    # same text pulled every vector toward the script instead of the meaning. Multilingual
    # questions still match, because the model maps languages into one space.
    ayahs = _rows(
        "SELECT verse_key, arabic, translation_en, translation_ur FROM ayahs ORDER BY surah_number, ayah_number"
    )
    _index(
        [
            {
                "ref": f"Quran {vk}",
                "embed": en or "",
                "content": f"Quran {vk}. Arabic: {ar}. English: {en}. Urdu: {ur}.",
                "meta": {"verse_key": vk},
            }
            for vk, ar, en, ur in ayahs
        ],
        "quran",
        model,
        done,
        is_sqlite,
    )

    hadiths = _rows("SELECT id, reference, chapter_en, english FROM hadiths ORDER BY id")
    _index(
        [
            {
                "ref": ref,
                "embed": f"{ch}. {en}",
                "content": f"{ref}. Chapter: {ch}. English: {(en or '')[:1500]}.",
                "meta": {"hadith_id": hid},
            }
            for hid, ref, ch, en in hadiths
        ],
        "hadith",
        model,
        done,
        is_sqlite,
    )

    duas = _rows("SELECT id, title_en, arabic, transliteration, translation_en, translation_ur, source FROM duas")
    _index(
        [
            {
                "ref": f"Dua {did}",
                "embed": f"{title}. {en}",
                "content": (
                    f"Dua {did}: {title}. Arabic: {ar}. Transliteration: {tr}. "
                    f"English: {en}. Urdu: {ur}. Source: {src}"
                ),
                "meta": {"dua_id": did},
            }
            for did, title, ar, tr, en, ur, src in duas
        ],
        "dua",
        model,
        done,
        is_sqlite,
    )
    print("Embedding index complete.")


if __name__ == "__main__":
    main()
