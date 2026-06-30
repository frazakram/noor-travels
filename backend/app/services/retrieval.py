"""Unified retrieval: local embeddings + keyword fallback."""
import re
from typing import Any

from app.core.config import get_settings
from app.db import get_conn, use_sqlite
from app.services.hybrid_retriever import hybrid_retrieve, rerank
from app.services.keyword_search import (
    extract_search_terms,
    format_curated_answer,
    format_dua_answer,
    format_surah_number_answer,
    format_surah_summary_answer,
    format_verse_answer,
    format_verse_range_answer,
    keyword_retrieve_smart,
)
from app.services.query_expansion import DUA_HINT, build_analysis, get_theme_summary


def _is_surah_number_question(question: str) -> bool:
    from app.services.keyword_search import detect_surah_number_lookup

    return detect_surah_number_lookup(question) is not None


def _embedding_chunk_count() -> int:
    try:
        with get_conn() as conn:
            cur = conn.cursor()
            cur.execute("SELECT COUNT(*) FROM document_chunks")
            row = cur.fetchone()
            if use_sqlite():
                return int(row[0] if not isinstance(row, dict) else list(row.values())[0])
            return int(row["count"] if isinstance(row, dict) else row[0])
    except Exception:
        return 0


def retrieve_for_question(question: str, lang: str = "en") -> tuple[list[dict], dict[str, Any]]:
    """Retrieve relevant chunks: semantic (bge-m3) when indexed, plus keyword expansion."""
    settings = get_settings()

    from app.services.keyword_search import _has_surah_context, detect_surah_number, is_verse_query

    if is_verse_query(question):
        return keyword_retrieve_smart(question, lang)

    if _is_surah_number_question(question):
        return keyword_retrieve_smart(question, lang)

    surah_num = detect_surah_number(question)
    if surah_num and not (DUA_HINT.search(question) and not _has_surah_context(question)):
        # If the question asks about a theme within a surah (e.g. "jihad in Surah Imran"),
        # don't short-circuit to surah_summary — do full hybrid retrieval so theme-specific
        # verses surface instead of returning the whole surah in order.
        from app.services.query_expansion import match_themes
        has_theme = bool(match_themes(question))
        if not has_theme:
            return keyword_retrieve_smart(question, lang)

    analysis = build_analysis(question, lang, extract_search_terms(question))
    search_queries = list(dict.fromkeys([question, *analysis["search_terms"][:6]]))
    source_filter = analysis["source_filter"]
    candidates: list[dict] = []

    if _embedding_chunk_count() > 50:
        try:
            candidates.extend(hybrid_retrieve(search_queries, source_filter))
        except Exception:
            pass

    kw_chunks, kw_analysis = keyword_retrieve_smart(question, lang)
    candidates.extend(kw_chunks)
    analysis = {**kw_analysis, **analysis, "search_terms": analysis["search_terms"]}

    # Pin cluster-specific verse keys so theme questions always surface the right ayahs
    from app.services.keyword_search import _fetch_ayah_chunks
    from app.services.query_expansion import match_themes
    for cluster in match_themes(question):
        pinned = _fetch_ayah_chunks(cluster.get("verse_keys") or [])
        for p in pinned:
            p["final_score"] = 0.85
        candidates.extend(pinned)

    merged = rerank(" ".join(analysis["search_terms"]), candidates, settings.rag_retrieval_k)
    merged = _filter_dua_by_theme(merged, analysis)
    return merged, analysis


def _filter_dua_by_theme(chunks: list[dict], analysis: dict[str, Any]) -> list[dict]:
    """Drop off-theme duas when a thematic cluster specifies dua_categories."""
    dua_categories = analysis.get("dua_categories") or []
    if not dua_categories:
        return chunks
    filtered: list[dict] = []
    for c in chunks:
        if c.get("source_type") != "dua":
            filtered.append(c)
            continue
        cat = (c.get("metadata") or {}).get("category", "travel")
        if cat in dua_categories:
            filtered.append(c)
    return filtered if filtered else [c for c in chunks if c.get("source_type") != "dua"]


def format_short_answer(
    question: str,
    chunks: list[dict],
    analysis: dict[str, Any],
    lang: str,
) -> str:
    """Return a concise answer; full quotes live in sources for the UI to expand."""
    if analysis.get("intent") == "verse_range_lookup" and analysis.get("surah_number"):
        return format_verse_range_answer(
            analysis["surah_number"],
            analysis["ayah_start"],
            analysis["ayah_end"],
            lang,
        )

    if analysis.get("intent") == "verse_lookup" and analysis.get("verse_keys"):
        return format_verse_answer(analysis["verse_keys"][0], lang)

    if analysis.get("intent") == "surah_number_lookup" and analysis.get("surah_number"):
        return format_surah_number_answer(analysis["surah_number"], lang)

    if analysis.get("intent") == "surah_summary" and analysis.get("surah_number"):
        return format_surah_summary_answer(analysis["surah_number"], lang, question)

    themes = analysis.get("themes") or []
    themed = get_theme_summary(themes, lang)
    if themed:
        return themed

    curated = format_curated_answer(chunks, lang, analysis)
    if curated:
        return curated

    if DUA_HINT.search(question):
        dua_answer = format_dua_answer(chunks, lang)
        if dua_answer:
            return dua_answer

    if DUA_HINT.search(question) and not any(c["source_type"] == "dua" for c in chunks[:5]):
        if lang == "ur":
            return (
                "اس مخصوص موضوع کی دعا ہمارے مجموعے میں نہیں ہے۔ "
                "ذیل میں قرآن و حدیث سے متعلقہ حوالے دیکھیں۔"
            )
        if lang == "hi":
            return (
                "इस विषय की विशेष दुआ हमारे संग्रह में नहीं है। "
                "नीचे कुरान और हदीस के संबंधित स्रोत देखें।"
            )
        return (
            "We don't have a dedicated dua for this topic in our collection yet. "
            "See the sources below for related Quran and Hadith passages."
        )

    # Always try to surface real content from chunks — never leave users with a generic pointer.
    built = _build_answer_from_chunks(chunks, lang)
    if built:
        return built

    if lang == "ur":
        return "ذیل میں آپ کے سوال سے متعلقہ قرآن، حدیث اور دعاؤں کے حوالے ہیں۔"
    if lang == "hi":
        return "नीचे आपके प्रश्न से संबंधित कुरान, हदीस और दुआ के स्रोत हैं।"
    return "See the sources below for relevant Quran, Hadith, and dua passages related to your question."


def _extract_chunk_field(content: str, field: str) -> str:
    """Extract a named field from structured chunk content like 'Field: value. Next: ...'"""
    key = f"{field}: "
    idx = content.find(key)
    if idx < 0:
        return ""
    start = idx + len(key)
    m = re.search(r"\.\s+[A-Z][a-z]+:", content[start:])
    if m:
        return content[start : start + m.start()].strip().rstrip(".")
    return content[start:].strip().rstrip(".")


def _build_answer_from_chunks(chunks: list[dict], lang: str) -> str:
    """Build a concrete answer from top retrieved chunks when no specific formatter matches.

    Ensures users always see actual Quran/Hadith/dua text, not just a navigation hint.
    """
    if not chunks:
        return ""

    intros = {
        "en": "Here is what the Quran, Hadith, and duas say:",
        "ur": "قرآن، حدیث اور دعاؤں سے:",
        "hi": "कुरान, हदीस और दुआओं से:",
    }

    parts: list[str] = []

    # Dua chunks → use the dedicated formatter (it already knows the content format)
    dua_chunks = [c for c in chunks[:6] if c.get("source_type") == "dua"]
    if dua_chunks:
        dua_text = format_dua_answer(dua_chunks, lang)
        if dua_text:
            parts.append(dua_text)

    # Quran and hadith chunks → extract the translation text
    for chunk in chunks[:8]:
        if len(parts) >= 3:
            break
        stype = chunk.get("source_type", "")
        content = chunk.get("content", "")
        ref = chunk.get("source_ref", "")

        if stype == "dua":
            continue  # already handled above

        if stype == "quran":
            if lang == "ur":
                text = _extract_chunk_field(content, "Urdu")
            else:
                text = _extract_chunk_field(content, "English")
            if text and len(text) > 10:
                parts.append(f"• {ref}\n{text[:320]}")

        elif stype == "hadith":
            text = _extract_chunk_field(content, "English")
            if text and len(text) > 15:
                parts.append(f"• {ref}\n{text[:320]}")

        elif stype == "tafsir":
            # Strip the "Tafsir src key: " prefix and take the first sentence(s)
            body = re.sub(r"^Tafsir\s+\S+\s+[\d:]+\s*:\s*", "", content, count=1)
            sentences = re.split(r"(?<=[.!?])\s+", body.strip())
            text = " ".join(sentences[:2]).strip()[:280]
            if len(text) > 30:
                parts.append(f"• {ref}\n{text}")

    if not parts:
        return ""

    intro = intros.get(lang, intros["en"])
    return intro + "\n\n" + "\n\n".join(parts)


# Backward-compatible alias
format_answer_from_chunks = format_short_answer
