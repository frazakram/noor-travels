import re
from typing import Any

from app.core.config import get_settings
from app.db import get_conn, search_embeddings, use_sqlite
from app.services.embedding_service import embed_texts

RRF_K = 60


def _tokenize(text: str) -> set[str]:
    return set(re.findall(r"[a-zA-Z\u0600-\u06FF\u0900-\u097F]{3,}", text.lower()))


def _lexical_score(query: str, content: str) -> float:
    q_tokens = _tokenize(query)
    if not q_tokens:
        return 0.0
    c_tokens = _tokenize(content)
    overlap = len(q_tokens & c_tokens)
    return overlap / len(q_tokens)


def _rrf_merge(ranked_lists: list[list[dict]], key_fn=lambda x: x["source_ref"]) -> list[dict]:
    scores: dict[str, float] = {}
    items: dict[str, dict] = {}
    for lst in ranked_lists:
        for rank, item in enumerate(lst):
            key = key_fn(item)
            scores[key] = scores.get(key, 0.0) + 1.0 / (RRF_K + rank + 1)
            items[key] = item
    merged = []
    for key, score in sorted(scores.items(), key=lambda x: x[1], reverse=True):
        row = dict(items[key])
        row["rrf_score"] = score
        merged.append(row)
    return merged


def _fts_search(query: str, source_filter: list[str], limit: int) -> list[dict]:
    if not use_sqlite():
        return []
    # FTS5: quote terms for phrase search; fallback to OR
    terms = [t for t in re.findall(r"\w+", query) if len(t) > 2][:6]
    if not terms:
        return []
    fts_query = " OR ".join(terms)

    with get_conn() as conn:
        cur = conn.cursor()
        try:
            cur.execute(
                """
                SELECT source_ref, content, source_type, chunk_id,
                       bm25(chunks_fts) AS rank
                FROM chunks_fts
                WHERE chunks_fts MATCH ?
                ORDER BY rank
                LIMIT ?
                """,
                (fts_query, limit * 2),
            )
            rows = cur.fetchall()
        except Exception:
            return []

    results = []
    for source_ref, content, source_type, _chunk_id, rank in rows:
        if source_filter and source_type not in source_filter:
            continue
        # bm25 lower is better in sqlite fts5
        lexical = 1.0 / (1.0 + abs(rank or 0))
        results.append(
            {
                "source_type": source_type,
                "source_ref": source_ref,
                "content": content,
                "metadata": {},
                "similarity": lexical,
                "lexical_score": lexical,
            }
        )
    return results[:limit]


def _direct_table_search(query: str, source_filter: list[str], limit: int) -> list[dict]:
    """Keyword search on ayahs / hadiths for high-recall."""
    results: list[dict] = []
    pattern = f"%{query}%"

    with get_conn() as conn:
        cur = conn.cursor()
        if "quran" in source_filter:
            if use_sqlite():
                cur.execute(
                    """
                    SELECT verse_key, arabic, transliteration, translation_en, translation_ur
                    FROM ayahs
                    WHERE translation_en LIKE ? OR translation_ur LIKE ?
                       OR transliteration LIKE ? OR arabic LIKE ?
                    LIMIT ?
                    """,
                    (pattern, pattern, pattern, pattern, limit),
                )
            else:
                cur.execute(
                    """
                    SELECT verse_key, arabic, transliteration, translation_en, translation_ur
                    FROM ayahs
                    WHERE translation_en ILIKE %s OR translation_ur ILIKE %s
                       OR transliteration ILIKE %s OR arabic ILIKE %s
                    LIMIT %s
                    """,
                    (pattern, pattern, pattern, pattern, limit),
                )
            for row in cur.fetchall():
                if use_sqlite():
                    vk, ar, tr, en, ur = row
                else:
                    vk, ar, tr, en, ur = row["verse_key"], row["arabic"], row["transliteration"], row["translation_en"], row["translation_ur"]
                content = f"Quran {vk}. Arabic: {ar}. English: {en}. Urdu: {ur}."
                results.append(
                    {
                        "source_type": "quran",
                        "source_ref": f"Quran {vk}",
                        "content": content,
                        "metadata": {"verse_key": vk},
                        "similarity": 0.5,
                    }
                )

        if "hadith" in source_filter:
            if use_sqlite():
                cur.execute(
                    """
                    SELECT id, reference, chapter_en, arabic, english
                    FROM hadiths
                    WHERE english LIKE ? OR chapter_en LIKE ? OR arabic LIKE ?
                    LIMIT ?
                    """,
                    (pattern, pattern, pattern, limit),
                )
            else:
                cur.execute(
                    """
                    SELECT id, reference, chapter_en, arabic, english
                    FROM hadiths
                    WHERE english ILIKE %s OR chapter_en ILIKE %s OR arabic ILIKE %s
                    LIMIT %s
                    """,
                    (pattern, pattern, pattern, limit),
                )
            for row in cur.fetchall():
                if use_sqlite():
                    hid, ref, ch, ar, en = row
                else:
                    hid, ref, ch, ar, en = row["id"], row["reference"], row["chapter_en"], row["arabic"], row["english"]
                content = f"{ref}. Chapter: {ch}. English: {en[:1500]}."
                results.append(
                    {
                        "source_type": "hadith",
                        "source_ref": ref,
                        "content": content,
                        "metadata": {"hadith_id": hid},
                        "similarity": 0.5,
                    }
                )

        if "dua" in source_filter:
            if use_sqlite():
                cur.execute(
                    """
                    SELECT id, title_en, arabic, transliteration, translation_en, translation_ur, source
                    FROM duas
                    WHERE title_en LIKE ? OR translation_en LIKE ? OR translation_ur LIKE ?
                       OR transliteration LIKE ? OR arabic LIKE ?
                    LIMIT ?
                    """,
                    (pattern, pattern, pattern, pattern, pattern, limit),
                )
            else:
                cur.execute(
                    """
                    SELECT id, title_en, arabic, transliteration, translation_en, translation_ur, source
                    FROM duas
                    WHERE title_en ILIKE %s OR translation_en ILIKE %s OR translation_ur ILIKE %s
                       OR transliteration ILIKE %s OR arabic ILIKE %s
                    LIMIT %s
                    """,
                    (pattern, pattern, pattern, pattern, pattern, limit),
                )
            for row in cur.fetchall():
                if use_sqlite():
                    did, title, ar, tr, en, ur, src = row
                else:
                    did = row["id"]
                    title, ar, tr, en, ur, src = (
                        row["title_en"],
                        row["arabic"],
                        row["transliteration"],
                        row["translation_en"],
                        row["translation_ur"],
                        row["source"],
                    )
                content = (
                    f"Dua {did}: {title}. Arabic: {ar}. Transliteration: {tr}. "
                    f"English: {en}. Urdu: {ur}. Source: {src}"
                )
                results.append(
                    {
                        "source_type": "dua",
                        "source_ref": f"Dua {did}",
                        "content": content,
                        "metadata": {"dua_id": did},
                        "similarity": 0.65,
                    }
                )

        if "tafsir" in source_filter:
            if use_sqlite():
                cur.execute(
                    """
                    SELECT verse_key, source, text FROM tafsir
                    WHERE text LIKE ? OR verse_key LIKE ?
                    LIMIT ?
                    """,
                    (pattern, pattern, limit),
                )
            else:
                cur.execute(
                    """
                    SELECT verse_key, source, text FROM tafsir
                    WHERE text ILIKE %s OR verse_key ILIKE %s
                    LIMIT %s
                    """,
                    (pattern, pattern, limit),
                )
            for row in cur.fetchall():
                if use_sqlite():
                    vk, src, txt = row
                else:
                    vk, src, txt = row["verse_key"], row["source"], row["text"]
                content = f"Tafsir {src} {vk}: {txt[:2000]}"
                results.append(
                    {
                        "source_type": "tafsir",
                        "source_ref": f"Tafsir {vk} ({src})",
                        "content": content,
                        "metadata": {"verse_key": vk, "tafsir_source": src},
                        "similarity": 0.5,
                    }
                )

    return results


def keyword_retrieve(
    search_queries: list[str],
    source_filter: list[str],
) -> list[dict]:
    """FTS + direct table search only — no OpenAI embeddings."""
    settings = get_settings()
    all_keyword: list[dict] = []
    per_query_k = max(8, settings.rag_retrieval_k // max(1, len(search_queries)))

    for query in search_queries:
        all_keyword.extend(_fts_search(query, source_filter, per_query_k))
        all_keyword.extend(_direct_table_search(query, source_filter, per_query_k // 2))

    merged = _rrf_merge([all_keyword]) if all_keyword else []
    return merged[: settings.rag_retrieval_k]


def hybrid_retrieve(
    search_queries: list[str],
    source_filter: list[str],
) -> list[dict]:
    settings = get_settings()
    all_semantic: list[dict] = []
    all_keyword: list[dict] = []

    embeddings = embed_texts(search_queries)
    per_query_k = max(8, settings.rag_retrieval_k // len(search_queries))

    for query, emb in zip(search_queries, embeddings):
        semantic = search_embeddings(emb, settings.rag_min_similarity, per_query_k)
        if source_filter:
            semantic = [s for s in semantic if s["source_type"] in source_filter]
        all_semantic.extend(semantic)

        kw_fts = _fts_search(query, source_filter, per_query_k)
        kw_direct = _direct_table_search(query, source_filter, per_query_k // 2)
        all_keyword.extend(kw_fts)
        all_keyword.extend(kw_direct)

    merged = _rrf_merge([all_semantic, all_keyword])
    return merged[: settings.rag_retrieval_k]


def rerank(query: str, chunks: list[dict], final_k: int) -> list[dict]:
    """LLM-free rerank: combine RRF + lexical overlap on content."""
    for c in chunks:
        lex = _lexical_score(query, c.get("content", ""))
        sem = float(c.get("similarity", c.get("rrf_score", 0)))
        rrf = float(c.get("rrf_score", 0))
        boost = 0.35 if c.get("metadata", {}).get("curated") else 0.0
        if c.get("metadata", {}).get("theme_pinned"):
            boost += 0.55
        c["final_score"] = 0.45 * sem + 0.35 * rrf + 0.20 * lex + boost

    ranked = sorted(chunks, key=lambda x: x["final_score"], reverse=True)
    # Deduplicate by source_ref keeping best score
    seen: dict[str, dict] = {}
    for c in ranked:
        ref = c["source_ref"]
        if ref not in seen or c["final_score"] > seen[ref]["final_score"]:
            seen[ref] = c
    return sorted(seen.values(), key=lambda x: x["final_score"], reverse=True)[:final_k]
