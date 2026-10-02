import re
from concurrent.futures import ThreadPoolExecutor

from app.core.config import get_settings
from app.db import search_embeddings
from app.services.embedding_service import embed_texts

RRF_K = 60
_VECTOR_POOL = ThreadPoolExecutor(max_workers=4, thread_name_prefix="vector-search")


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


def semantic_retrieve(queries: list[str], source_filter: list[str]) -> list[dict]:
    """Vector search only. Word matching is keyword_search's job (indexed, IDF-ranked);
    this path exists to catch sources worded unlike the question."""
    settings = get_settings()
    per_query_k = max(8, settings.rag_retrieval_k // len(queries))
    embeddings = embed_texts(queries)  # one round trip for all phrases
    ranked = list(
        _VECTOR_POOL.map(
            lambda emb: search_embeddings(emb, settings.rag_min_similarity, per_query_k, settings.semantic_model),
            embeddings,
        )
    )
    if source_filter:
        ranked = [[r for r in lst if r["source_type"] in source_filter] for lst in ranked]
    return _rrf_merge(ranked)[: settings.rag_retrieval_k]


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
