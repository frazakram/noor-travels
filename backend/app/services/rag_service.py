import json
import re
from typing import Any

from openai import APIError, OpenAI

from app.core.config import get_settings
from app.services.answer_validator import validate_answer
from app.services.cache import get_cached, make_cache_key, set_cached
from app.services.hybrid_retriever import rerank
from app.services.retrieval import format_short_answer, retrieve_for_question
from app.services.query_analyzer import analyze_query

SYSTEM_PROMPT = """You are Noor Safar — an Islamic learning chat assistant for travelers.
Answer ONLY using the provided sources. Every factual claim MUST have a citation.
If sources are insufficient, clearly say you could not find a cited answer — do not guess.
Never issue fatwas, personal rulings, or medical/legal advice.

LANGUAGE RULES (strict):
- Write the entire explanation ONLY in the requested response language.
- Do NOT mix Hindi, Urdu, and English in the explanation text.
- Arabic script may appear ONLY when directly quoting a dua or ayah from sources.
- If response language is English: explanation in English; quote Arabic then give meaning in English.
- If response language is Urdu: explanation in Urdu script only.
- If response language is Hindi: explanation in Devanagari Hindi only.

TRANSLITERATION RULES:
- If include_transliteration is true: put ALL roman transliterations in the separate "transliteration" field (not in answer).
- transliteration field: roman Latin script for Arabic quotes and key terms, one per line.
- If include_transliteration is false: leave transliteration as empty string.

Citation format: [Quran 2:255], [Sahih al-Bukhari 431], [Dua travel-4]

Return JSON:
{
  "answer": "explanation in requested language ONLY",
  "transliteration": "roman transliterations or empty string",
  "citations": ["list of citation strings used"],
  "confidence": "high|medium|low"
}"""


def chat(
    question: str,
    lang: str = "en",
    history: list[dict[str, str]] | None = None,
    response_lang: str | None = None,
    include_transliteration: bool = True,
) -> dict[str, Any]:
    settings = get_settings()
    history = history or []
    out_lang = response_lang or lang

    history_tail = " ".join(m["content"] for m in history[-2:])
    cache_key = make_cache_key(question, out_lang, history_tail, include_transliteration)
    cached = get_cached(cache_key)
    if cached:
        cached["from_cache"] = True
        return cached

    if not settings.use_openai_chat:
        return _chat_local(
            question,
            out_lang,
            include_transliteration,
            cache_key=cache_key,
            intentional_local=True,
        )

    client = OpenAI(api_key=settings.openai_api_key)
    try:
        result = _chat_with_openai(
            client,
            question,
            out_lang,
            history,
            include_transliteration,
            analysis=None,
            cache_key=cache_key,
        )
        return _apply_validation(question, result)
    except APIError as exc:
        if not _is_quota_or_auth_error(exc):
            raise
        return _chat_local(
            question,
            out_lang,
            include_transliteration,
            reason=str(exc.message) if hasattr(exc, "message") else "OpenAI unavailable",
        )


def _is_quota_or_auth_error(exc: APIError) -> bool:
    code = getattr(exc, "code", None) or ""
    body = str(exc).lower()
    return code in ("insufficient_quota", "rate_limit_exceeded", "invalid_api_key") or "quota" in body


def _public_analysis(analysis: dict) -> dict:
    return {
        "intent": analysis.get("intent", ""),
        "detected_language": analysis.get("detected_language", ""),
        "sources_searched": analysis.get("source_filter", []),
        "themes": analysis.get("themes", []),
    }


def _apply_validation(question: str, result: dict[str, Any]) -> dict[str, Any]:
    """Run rule-based checks; adjust confidence and surface issues."""
    analysis = result.get("analysis") or {}
    if isinstance(analysis, dict) and "themes" not in analysis:
        from app.services.query_expansion import build_analysis
        from app.services.keyword_search import extract_search_terms

        full = build_analysis(question, analysis.get("detected_language", "en"), extract_search_terms(question))
        analysis = {**full, **analysis}

    validation = validate_answer(
        question,
        result.get("answer", ""),
        result.get("sources") or [],
        analysis,
        result.get("citations") or [],
    )
    result["validation"] = {
        "valid": validation["valid"],
        "issues": validation["issues"],
        "themes_checked": validation.get("themes_checked", []),
    }
    if not validation["valid"]:
        result["confidence"] = validation["confidence"]
        if validation.get("suggested_notice") and not result.get("notice"):
            result["notice"] = validation["suggested_notice"]
    return result


def _chat_local(
    question: str,
    out_lang: str,
    include_transliteration: bool,
    reason: str = "",
    cache_key: str | None = None,
    intentional_local: bool = False,
) -> dict[str, Any]:
    chunks, analysis = retrieve_for_question(question, out_lang)
    if analysis.get("intent") not in ("verse_lookup", "verse_range_lookup"):
        chunks = rerank(" ".join(analysis.get("search_terms", [question])), chunks, get_settings().rag_final_k)

    if not chunks:
        result = {
            "answer": _no_result_message(out_lang),
            "transliteration": "",
            "citations": [],
            "sources": [],
            "confidence": "low",
            "analysis": _public_analysis(analysis),
            "from_cache": False,
            "mode": "local",
        }
        if intentional_local:
            result["notice"] = _local_mode_notice(out_lang)
        elif reason:
            result["notice"] = _fallback_notice(out_lang, reason)
        return _apply_validation(question, result)

    answer = format_short_answer(question, chunks, analysis, out_lang)
    source_limit = 20 if analysis.get("intent") == "verse_range_lookup" else 6
    citations = [_ref_from_chunk(c) for c in chunks[: min(4, source_limit)]]
    confidence = (
        "high"
        if analysis.get("intent") in ("surah_summary", "verse_lookup", "verse_range_lookup")
        else "medium"
    )
    source_snippet_len = 600

    result = {
        "answer": answer,
        "transliteration": "",
        "citations": citations,
        "confidence": confidence,
        "sources": [
            {
                "ref": c["source_ref"],
                "type": c["source_type"],
                "snippet": _clean_source_snippet(c["content"], source_snippet_len),
                "score": round(float(c.get("final_score", c.get("similarity", 0))), 3),
            }
            for c in chunks[:source_limit]
        ],
        "analysis": _public_analysis(analysis),
        "from_cache": False,
        "mode": "local",
    }
    if intentional_local:
        result["notice"] = _local_mode_notice(out_lang)
    elif reason:
        result["notice"] = _fallback_notice(out_lang, reason)

    result = _apply_validation(question, result)
    if cache_key:
        set_cached(cache_key, result)
    return result


def _local_mode_notice(lang: str) -> str:
    notes = {
        "en": "Answers are generated from your local Quran, Hadith, and dua database (no paid AI). Expand sources to verify.",
        "ur": "جوابات مقامی قرآن، حدیث اور دعا کے ڈیٹابیس سے ہیں (بلا معاوضہ AI)۔ تصدیق کے لیے ذرائع دیکھیں۔",
        "hi": "उत्तर स्थानीय कुरान, हदीस और दुआ डेटाबेस से हैं (मुफ़्त AI नहीं)। सत्यापन के लिए स्रोत देखें।",
    }
    return notes.get(lang, notes["en"])


def _fallback_notice(lang: str, reason: str) -> str:
    notes = {
        "en": "AI summary unavailable (OpenAI quota). Showing matching sources from local database.",
        "ur": "AI خلاصہ دستیاب نہیں (OpenAI کوٹہ)۔ مقامی ڈیٹابیس سے ملتے جلے ذرائع دکھائے جا رہے ہیں۔",
        "hi": "AI सारांश उपलब्ध नहीं (OpenAI कोटा)। स्थानीय डेटाबेस से मिलते-जुलते स्रोत दिखाए जा रहे हैं।",
    }
    return notes.get(lang, notes["en"])


def _format_keyword_answer(chunks: list[dict], lang: str) -> str:
    intros = {
        "en": "Here are the closest matches from Quran, Hadith, and duas:",
        "ur": "قرآن، حدیث اور دعاؤں سے ملتے جلے نتائج:",
        "hi": "कुरान, हदीस और दुआओं से मिलते-जुलते परिणाम:",
    }
    lines = [intros.get(lang, intros["en"])]
    for c in chunks[:3]:
        snippet = c["content"][:500].strip()
        lines.append(f"\n• {c['source_ref']}\n{snippet}")
    return "\n".join(lines)


def _chat_with_openai(
    client: OpenAI,
    question: str,
    out_lang: str,
    history: list[dict[str, str]],
    include_transliteration: bool,
    analysis: dict[str, Any] | None,
    cache_key: str,
) -> dict[str, Any]:
    analysis = analysis or analyze_query(client, question, out_lang, history)
    search_queries = analysis["search_queries_en"]
    source_filter = analysis["source_filter"] or ["quran", "hadith", "dua"]
    standalone = analysis["standalone_question"]

    # Always use local/unified retrieval (bge-m3 when indexed)
    chunks, _ = retrieve_for_question(standalone or question, out_lang)
    chunks = rerank(standalone, chunks, get_settings().rag_final_k)

    if not chunks:
        result = {
            "answer": _no_result_message(out_lang),
            "transliteration": "",
            "citations": [],
            "sources": [],
            "confidence": "low",
            "analysis": _public_analysis(analysis),
            "from_cache": False,
        }
        return result

    context = "\n\n---\n\n".join(
        f"SOURCE: [{c['source_ref']}] ({c['source_type']})\n{c['content'][:1200]}"
        for c in chunks
    )

    lang_name = {"en": "English", "ur": "Urdu", "hi": "Hindi"}.get(out_lang, "English")

    response = client.chat.completions.create(
        model=get_settings().chat_model,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    f"Response language: {lang_name} ONLY\n"
                    f"Include transliteration field: {include_transliteration}\n"
                    f"User question: {standalone}\n"
                    f"Original message: {question}\n\n"
                    f"RETRIEVED SOURCES:\n{context}\n\n"
                    "Answer using ONLY these sources. Put roman transliteration in transliteration field."
                ),
            },
        ],
        response_format={"type": "json_object"},
        temperature=0.15,
        max_tokens=900,
    )

    parsed = json.loads(response.choices[0].message.content or "{}")
    citations = _validate_citations(parsed.get("citations", []), chunks)
    transliteration = parsed.get("transliteration", "") if include_transliteration else ""

    result = {
        "answer": parsed.get("answer", ""),
        "transliteration": transliteration,
        "citations": citations,
        "confidence": parsed.get("confidence", "medium"),
        "sources": [
            {
                "ref": c["source_ref"],
                "type": c["source_type"],
                "snippet": c["content"][:280],
                "score": round(float(c.get("final_score", c.get("similarity", 0))), 3),
            }
            for c in chunks
        ],
        "analysis": _public_analysis(analysis),
        "from_cache": False,
        "mode": "openai",
    }

    set_cached(cache_key, result)
    return result


def ask(query: str, lang: str = "en") -> dict[str, Any]:
    return chat(query, lang, history=[], response_lang=lang, include_transliteration=True)


def _validate_citations(citations: list, chunks: list[dict]) -> list[str]:
    if not citations:
        return [_ref_from_chunk(c) for c in chunks[:3]]

    chunk_text = " ".join(c["source_ref"] + " " + c["content"] for c in chunks).lower()
    valid = []
    for cite in citations:
        cite_l = cite.lower()
        nums = re.findall(r"\d+:\d+|\d+", cite_l)
        if any(n in chunk_text for n in nums) or cite_l in chunk_text:
            valid.append(cite)
    return valid or [_ref_from_chunk(c) for c in chunks[:2]]


def _clean_source_snippet(content: str, max_len: int) -> str:
    text = content.strip()
    if len(text) <= max_len:
        return text
    return text[: max_len - 1].rstrip() + "…"


def _ref_from_chunk(c: dict) -> str:
    return c["source_ref"]


def _no_result_message(lang: str) -> str:
    messages = {
        "en": "I could not find a cited answer in the Quran, Hadith, or duas for this question. Try rephrasing or ask about travel, prayer, patience, or remembrance.",
        "ur": "میں قرآن، حدیث یا دعاؤں میں اس سوال کا حوالہ شدہ جواب نہیں ڈھونڈ سکا۔ براہ کرم سوال دوسرے الفاظ میں پوچھیں۔",
        "hi": "मैं कुरान, हदीस या दुआओं में इस प्रश्न का उद्धृत उत्तर नहीं ढूंढ सका। कृपया प्रश्न दोबारा पूछें।",
    }
    return messages.get(lang, messages["en"])
