#!/usr/bin/env python3
"""One-off build script: precompute English-translation-only embeddings for every
ayah, so the screenshot verse-identifier's English matching path (app/services/
quran_identify.py) can compare a live query against clean, single-language vectors
instead of the RAG chat's multi-language document_chunks embeddings.

Why this exists: document_chunks embeds "Quran {verse_key}. Arabic: ... English: ...
Urdu: ..." combined per ayah — fine for the RAG chat's thematic retrieval, but it
dilutes precision badly for "find the exact source verse of this translation phrase"
(empirically: cosine similarity for an exact Bismillah translation quote against its
own verse (1:1) was ~0.64 via document_chunks vs. ~0.98 against a clean English-only
embedding). This script produces that clean corpus once, offline.

Run with the frontend dev server up (EMBEDDING_PROVIDER=xenova calls its /api/embed
route) so the output vector space matches what live user queries get embedded into
at request time — same model, same dimensionality, comparable vectors.

    cd frontend && npm run dev   # separate terminal
    cd backend && EMBEDDING_PROVIDER=xenova FORCE_SQLITE=1 .venv/bin/python scripts/build_quran_en_embeddings.py

Chunking: each ayah is embedded as its FULL translation, plus separately as each
individual SENTENCE within it. A long multi-clause ayah's whole-verse embedding is an
average over everything in it — a short screenshot quoting just one clause scores
weakly against that average even when it's an exact semantic match for that one
clause (empirically: 0.447 cosine similarity for 6:25, a 4-sentence ayah, quoted only
at its second clause — below the 0.50 floor, so the correct verse silently never
appeared). Embedding each sentence separately lets a partial quote match the specific
clause it's from, not get diluted by the ayah's unrelated other clauses. Multiple rows
can map to the same verse_key — match_english already dedupes by verse_key downstream.

Output: backend/data/quran_en_embeddings.npy (float32, shape [N, dim]) +
        backend/data/quran_en_verse_keys.json (list[str], same row order, N >= 6236
        since most ayahs contribute more than one row).
"""

import json
import re
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.db import get_cursor  # noqa: E402
from app.services.embedding_service import embed_texts  # noqa: E402

OUT_DIR = Path(__file__).resolve().parent.parent / "data"
BATCH_SIZE = 32

_SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+")
_MIN_SENTENCE_CHARS = 15


def split_sentences(text: str) -> list[str]:
    return [s.strip() for s in _SENTENCE_SPLIT.split(text) if len(s.strip()) >= _MIN_SENTENCE_CHARS]


def build_chunks(text: str) -> list[str]:
    """Full verse + each sentence within it (deduped if the ayah is a single sentence,
    where the two would be identical)."""
    sentences = split_sentences(text)
    if len(sentences) <= 1:
        return [text]
    return [text] + sentences


def main() -> None:
    with get_cursor() as cur:
        cur.execute("SELECT verse_key, translation_en FROM ayahs ORDER BY surah_number, ayah_number")
        rows = cur.fetchall()

    verse_keys: list[str] = []
    texts: list[str] = []
    for r in rows:
        for chunk in build_chunks(r["translation_en"] or ""):
            verse_keys.append(r["verse_key"])
            texts.append(chunk)

    print(f"Embedding {len(texts)} chunks from {len(rows)} ayahs in batches of {BATCH_SIZE}...")

    vectors: list[list[float]] = []
    for i in range(0, len(texts), BATCH_SIZE):
        batch = texts[i : i + BATCH_SIZE]
        vectors.extend(embed_texts(batch))
        print(f"  {min(i + BATCH_SIZE, len(texts))}/{len(texts)}", end="\r")
    print()

    matrix = np.array(vectors, dtype=np.float32)
    assert matrix.shape[0] == len(verse_keys), "row count mismatch after embedding"

    OUT_DIR.mkdir(exist_ok=True)
    np.save(OUT_DIR / "quran_en_embeddings.npy", matrix)
    with open(OUT_DIR / "quran_en_verse_keys.json", "w", encoding="utf-8") as f:
        json.dump(verse_keys, f)

    print(f"Saved {matrix.shape} to {OUT_DIR / 'quran_en_embeddings.npy'}")


if __name__ == "__main__":
    main()
