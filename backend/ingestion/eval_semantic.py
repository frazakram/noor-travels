#!/usr/bin/env python3
"""Semantic search eval: does vector search put a correct source in the top 10?

Runs the same path chat uses (embed_texts -> search_embeddings) on English phrases like the
ones the rewrite model writes, each with the verses/hadith a correct answer must include.
No LLM calls, so it costs no Groq quota. Needs /api/embed (EMBED_API_URL) and the database.

    EMBEDDING_PROVIDER=xenova EMBED_API_URL=http://localhost:3001/api/embed FORCE_SQLITE= \\
      .venv/bin/python ingestion/eval_semantic.py

Model comparison (2026-10, English-only passages, these 34 cases, top 10):
MiniLM-L6 28, bge-small 29, arctic-embed-s 29, gte-small 28, multilingual-e5-small 26.
The old mixed Arabic/English/Urdu passages scored 6 of 24 on an earlier subset.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import get_settings  # noqa: E402
from app.db import get_cursor, search_embeddings  # noqa: E402
from app.services.embedding_service import embed_texts  # noqa: E402

CASES = json.loads((Path(__file__).parent / "data" / "semantic_eval.json").read_text())
PASS_AT = 27  # the measured result is 28/34; one case of slack for float noise across runtimes
TOP_K = 10


def _chapters(refs: list[str]) -> dict[str, str]:
    hadith = [r for r in refs if not r.startswith(("Quran", "Dua"))]
    if not hadith:
        return {}
    with get_cursor() as cur:
        marks = ", ".join(["%s"] * len(hadith))
        cur.execute(f"SELECT reference, chapter_en FROM hadiths WHERE reference IN ({marks})", hadith)
        return {r["reference"]: r["chapter_en"] or "" for r in cur.fetchall()}


def run() -> int:
    settings = get_settings()
    vectors = embed_texts([c["q"] for c in CASES])
    hits = 0
    for case, vector in zip(CASES, vectors):
        found = search_embeddings(vector, 0.0, TOP_K, settings.semantic_model)
        refs = [f["source_ref"] for f in found]
        chapters = _chapters(refs) if case.get("chapter") else {}
        rank = next(
            (
                i + 1
                for i, ref in enumerate(refs)
                if ref in case["expect"] or (case.get("chapter") and chapters.get(ref, "").startswith(case["chapter"]))
            ),
            0,
        )
        hits += bool(rank)
        top = f"{found[0]['similarity']:.2f}" if found else "-"
        print(f"[{'HIT ' if rank else 'MISS'}] rank={rank or '-':>2} top={top} {case['q']}")
        if not rank:
            print(f"        got={refs[:4]}")
    print(f"\n=== Semantic: {hits}/{len(CASES)} in top {TOP_K} (pass at {PASS_AT}) · model {settings.semantic_model} ===")
    return 0 if hits >= PASS_AT else 1


if __name__ == "__main__":
    sys.exit(run())
