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

STRICT GROUNDING RULES (never break these):
- Answer ONLY using text explicitly present in the RETRIEVED SOURCES below.
- Do NOT use your own knowledge of Islam, hadith, or Quran — only the provided sources.
- Every single factual claim MUST be followed by its citation in brackets.
- If the retrieved sources do not contain enough information, respond ONLY with the localized refusal phrase given in the user message (in the requested response language).
  Do NOT guess, infer, or paraphrase beyond what the sources say.
- Do NOT invent verse numbers, hadith numbers, or dua names.
- Do NOT issue fatwas, personal rulings, or religious opinions of your own.

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
  "answer": "explanation in requested language ONLY, strictly from sources",
  "transliteration": "roman transliterations or empty string",
  "citations": ["only citations that appear verbatim in the retrieved sources"],
  "confidence": "high|medium|low"
}"""


def _extract_verse_keys_from_text(text: str) -> list[str]:
    keys: list[str] = []
    for match in re.finditer(r"(?:quran\s*)?(\d{1,3}):(\d{1,3})", text, re.I):
        keys.append(f"{int(match.group(1))}:{int(match.group(2))}")
    return list(dict.fromkeys(keys))


def _merge_history_context(question: str, history: list[dict[str, str]]) -> tuple[str, list[str]]:
    verse_keys: list[str] = []
    for turn in history[-8:]:
        verse_keys.extend(_extract_verse_keys_from_text(turn.get("content", "")))

    standalone = question.strip()
    if history and len(question.split()) < 14:
        last_user = next((m["content"] for m in reversed(history) if m.get("role") == "user"), "")
        last_asst = next((m["content"] for m in reversed(history) if m.get("role") == "assistant"), "")
        if last_user and last_user.strip() != question.strip():
            standalone = f"{last_user.strip()} — {question.strip()}"
        elif last_asst:
            standalone = f"{last_asst[:240].strip()} — {question.strip()}"

    return standalone, list(dict.fromkeys(verse_keys))


def _normalize_source_score(score: float) -> float:
    return round(min(1.0, max(0.0, float(score))), 3)


def _chunk_sources(chunks: list[dict]) -> list[dict]:
    return [
        {
            "ref": c["source_ref"],
            "type": c["source_type"],
            "snippet": c["content"][:280],
            "score": _normalize_source_score(c.get("final_score", c.get("similarity", 0))),
        }
        for c in chunks
    ]


def _prioritize_chunks_for_question(question: str, chunks: list[dict]) -> list[dict]:
    from app.services.query_expansion import HADITH_HINT, PROPHET_HINT, TAFSIR_HINT

    if not chunks:
        return chunks
    if HADITH_HINT.search(question) or PROPHET_HINT.search(question):
        hadith = [c for c in chunks if c.get("source_type") == "hadith"]
        other = [c for c in chunks if c.get("source_type") != "hadith"]
        if hadith:
            return hadith + other
    if not TAFSIR_HINT.search(question):
        return chunks
    tafsir = [c for c in chunks if c.get("source_type") == "tafsir"]
    other = [c for c in chunks if c.get("source_type") != "tafsir"]
    return tafsir + other


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
    standalone, history_verse_keys = _merge_history_context(question, history)

    history_tail = " ".join(m["content"] for m in history[-2:])
    cache_key = make_cache_key(question, out_lang, history_tail, include_transliteration)
    cached = get_cached(cache_key)
    if cached:
        cached["from_cache"] = True
        return cached

    if settings.use_groq_chat:
        from app.services.keyword_search import extract_search_terms
        from app.services.query_expansion import build_analysis
        _la = build_analysis(standalone, out_lang, extract_search_terms(standalone))
        local_analysis = {
            **_la,
            "search_queries_en": _la.get("search_terms", [standalone]),
            "standalone_question": standalone,
            "history_verse_keys": history_verse_keys,
        }
        client = OpenAI(
            api_key=settings.groq_api_key,
            base_url="https://api.groq.com/openai/v1",
        )
        try:
            result = _chat_with_openai(
                client,
                question,
                out_lang,
                history,
                include_transliteration,
                analysis=local_analysis,
                cache_key=cache_key,
                model=get_settings().groq_chat_model,
                mode="groq",
            )
            result = _apply_validation(question, result)
            set_cached(cache_key, result)
            return result
        except APIError:
            # Any Groq failure (quota, auth, 5xx, network) degrades to the
            # grounded local answer instead of surfacing a 500 to the client.
            pass
        return _chat_local(
            question,
            out_lang,
            include_transliteration,
            reason="Groq unavailable",
            standalone=standalone,
            history_verse_keys=history_verse_keys,
        )

    if not settings.use_openai_chat:
        return _chat_local(
            question,
            out_lang,
            include_transliteration,
            cache_key=cache_key,
            intentional_local=True,
            standalone=standalone,
            history_verse_keys=history_verse_keys,
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
        result = _apply_validation(question, result)
        set_cached(cache_key, result)
        return result
    except APIError as exc:
        if not _is_quota_or_auth_error(exc):
            raise
        return _chat_local(
            question,
            out_lang,
            include_transliteration,
            reason=str(exc.message) if hasattr(exc, "message") else "OpenAI unavailable",
            standalone=standalone,
            history_verse_keys=history_verse_keys,
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
    standalone: str | None = None,
    history_verse_keys: list[str] | None = None,
) -> dict[str, Any]:
    query = standalone or question
    chunks, analysis = retrieve_for_question(
        query,
        out_lang,
        context_verse_keys=history_verse_keys or [],
    )
    from app.services.query_expansion import HADITH_HINT, PROPHET_HINT

    wants_hadith = bool(HADITH_HINT.search(query) or PROPHET_HINT.search(query))
    hadith_reserve: list[dict] = []
    if wants_hadith:
        curated = [
            c
            for c in chunks
            if c.get("source_type") == "hadith"
            and (c.get("metadata") or {}).get("curated")
        ]
        if curated:
            hadith_reserve = curated
        else:
            hadith_reserve = sorted(
                [c for c in chunks if c.get("source_type") == "hadith"],
                key=lambda c: float(c.get("final_score", c.get("similarity", 0))),
                reverse=True,
            )[:3]
    if analysis.get("intent") not in ("verse_lookup", "verse_range_lookup"):
        chunks = rerank(" ".join(analysis.get("search_terms", [query])), chunks, get_settings().rag_final_k)
    if hadith_reserve:
        seen = {c.get("source_ref") for c in chunks}
        for h in hadith_reserve:
            if h.get("source_ref") not in seen:
                chunks.insert(0, h)
    if wants_hadith:
        for c in chunks:
            if c.get("source_type") == "hadith":
                c["final_score"] = max(float(c.get("final_score", c.get("similarity", 0))), 0.9)
    chunks = _prioritize_chunks_for_question(query, chunks)

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

    answer = format_short_answer(query, chunks, analysis, out_lang)
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
                "score": _normalize_source_score(c.get("final_score", c.get("similarity", 0))),
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


def _top_chunk_score(chunks: list[dict]) -> float:
    return max((float(c.get("final_score", c.get("similarity", 0))) for c in chunks), default=0.0)


def _is_generic_pointer(answer: str) -> bool:
    lower = answer.lower()
    return any(
        p in lower
        for p in (
            "see the sources below",
            "ذیل میں",
            "नीचे",
            "could not find",
        )
    )


def _try_fast_local_answer(
    question: str,
    standalone: str,
    out_lang: str,
    chunks: list[dict],
    merged_analysis: dict[str, Any],
    cache_key: str,
    mode: str,
) -> dict[str, Any] | None:
    """Return a grounded local answer without calling the LLM when retrieval is confident."""
    if not chunks:
        return None

    answer = format_short_answer(standalone or question, chunks, merged_analysis, out_lang)
    if not answer or len(answer.strip()) < 20 or _is_refusal_answer(answer):
        return None

    intent = merged_analysis.get("intent", "")
    themes = merged_analysis.get("themes") or []
    top_score = _top_chunk_score(chunks)

    from app.services.query_expansion import get_theme_summary

    fast_intents = {"surah_summary", "verse_lookup", "verse_range_lookup", "surah_number_lookup"}
    if intent in fast_intents or get_theme_summary(themes, out_lang):
        confidence = "high"
    elif top_score >= 0.32 and not _is_generic_pointer(answer):
        confidence = "medium" if top_score < 0.55 else "high"
    elif len(answer.strip()) > 90 and not _is_generic_pointer(answer) and top_score >= 0.22:
        confidence = "medium"
    else:
        return None

    result = {
        "answer": answer,
        "transliteration": "",
        "citations": [_ref_from_chunk(c) for c in chunks[:4]],
        "confidence": confidence,
        "sources": _chunk_sources(chunks),
        "analysis": _public_analysis(merged_analysis),
        "from_cache": False,
        "mode": f"{mode}_local",
    }
    set_cached(cache_key, result)
    return result


def _chat_with_openai(
    client: OpenAI,
    question: str,
    out_lang: str,
    history: list[dict[str, str]],
    include_transliteration: bool,
    analysis: dict[str, Any] | None,
    cache_key: str,
    model: str | None = None,
    mode: str = "openai",
) -> dict[str, Any]:
    analysis = analysis or analyze_query(client, question, out_lang, history)
    search_queries = analysis["search_queries_en"]
    source_filter = analysis["source_filter"] or ["quran", "hadith", "dua"]
    standalone = analysis.get("standalone_question") or question
    history_verse_keys = analysis.get("history_verse_keys") or []

    # Always use local/unified retrieval (bge-m3 when indexed)
    chunks, _ = retrieve_for_question(
        standalone or question,
        out_lang,
        context_verse_keys=history_verse_keys,
    )
    chunks = _prioritize_chunks_for_question(standalone or question, chunks)
    chunks = rerank(standalone, chunks, get_settings().rag_final_k)

    from app.services.keyword_search import extract_search_terms
    from app.services.query_expansion import build_analysis

    merged_analysis = {
        **build_analysis(standalone or question, out_lang, extract_search_terms(standalone or question)),
        **(analysis or {}),
    }
    fast = _try_fast_local_answer(
        question, standalone or question, out_lang, chunks, merged_analysis, cache_key, mode
    )
    if fast:
        return fast

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
        f"SOURCE: [{c['source_ref']}] ({c['source_type']})\n{c['content'][:900]}"
        for c in chunks[:6]
    )

    lang_name = {"en": "English", "ur": "Urdu", "hi": "Hindi"}.get(out_lang, "English")
    refusal_phrase = _localized_refusal(out_lang)

    # Build conversation turns: include last 6 history turns for context
    prior_turns: list[dict] = []
    for h in (history or [])[-6:]:
        if h.get("role") in ("user", "assistant") and h.get("content"):
            prior_turns.append({"role": h["role"], "content": str(h["content"])[:600]})

    llm_messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    llm_messages.extend(prior_turns)
    llm_messages.append({
        "role": "user",
        "content": (
            f"Response language: {lang_name} ONLY\n"
            f"Refusal phrase (use exactly if sources are insufficient): {refusal_phrase}\n"
            f"Include transliteration field: {include_transliteration}\n"
            f"User question: {standalone}\n"
            f"Original message: {question}\n\n"
            f"RETRIEVED SOURCES (these are the ONLY facts you may use):\n{context}\n\n"
            "IMPORTANT: Use ONLY the text in RETRIEVED SOURCES above. "
            "Do not use any outside knowledge. Cite every claim."
        ),
    })

    response = client.chat.completions.create(
        model=model or get_settings().chat_model,
        messages=llm_messages,
        response_format={"type": "json_object"},
        temperature=0,
        max_tokens=450,
    )

    try:
        parsed = json.loads(response.choices[0].message.content or "{}")
    except ValueError:
        parsed = {}
    if not isinstance(parsed, dict):
        parsed = {}
    answer = (parsed.get("answer") or "").strip()
    if not answer or len(answer) < 12:
        fallback = format_short_answer(standalone or question, chunks, merged_analysis, out_lang)
        if fallback and not _is_refusal_answer(fallback):
            answer = fallback
    if _is_refusal_answer(answer) and chunks:
        from app.services.keyword_search import extract_search_terms
        from app.services.query_expansion import build_analysis

        fallback_analysis = analysis or build_analysis(
            question, out_lang, extract_search_terms(question)
        )
        fallback = format_short_answer(question, chunks, fallback_analysis, out_lang)
        if fallback and not _is_refusal_answer(fallback):
            answer = fallback

    citations = _validate_citations(parsed.get("citations", []), chunks)
    transliteration = parsed.get("transliteration", "") if include_transliteration else ""

    result = {
        "answer": answer,
        "transliteration": transliteration,
        "citations": citations,
        "confidence": parsed.get("confidence", "medium"),
        "sources": _chunk_sources(chunks),
        "analysis": _public_analysis(analysis),
        "from_cache": False,
        "mode": mode,
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
        cite_l = str(cite).lower()
        # Whole-number matches only: a hallucinated "Bukhari 43" must not pass
        # because "431" appears somewhere in the retrieved text.
        nums = re.findall(r"\d+:\d+|\d+", cite_l)
        matched = any(
            re.search(rf"(?<![\d:]){re.escape(n)}(?![\d:])", chunk_text) for n in nums
        )
        if matched or (not nums and cite_l in chunk_text):
            valid.append(cite)
    return valid or [_ref_from_chunk(c) for c in chunks[:2]]


def _clean_source_snippet(content: str, max_len: int) -> str:
    text = content.strip()
    if len(text) <= max_len:
        return text
    return text[: max_len - 1].rstrip() + "…"


def _ref_from_chunk(c: dict) -> str:
    return c["source_ref"]


def _refusal_phrases() -> tuple[str, ...]:
    return (
        "could not find a cited answer",
        "could not find a cited answer for this question",
        "میں قرآن",
        "मैं कुरान",
    )


def _is_refusal_answer(answer: str) -> bool:
    lower = (answer or "").lower()
    return any(p in lower for p in _refusal_phrases())


def _localized_refusal(lang: str) -> str:
    messages = {
        "en": "I could not find a cited answer for this question in the available Quran, Hadith, and dua sources.",
        "ur": "میں قرآن، حدیث اور دعاؤں میں اس سوال کا حوالہ شدہ جواب نہیں ڈھونڈ سکا۔",
        "hi": "मैं कुरान, हदीस और दुआओं में इस प्रश्न का उद्धृत उत्तर नहीं ढूंढ सका।",
    }
    return messages.get(lang, messages["en"])


def _no_result_message(lang: str) -> str:
    messages = {
        "en": "I could not find a cited answer in the Quran, Hadith, or duas for this question. Try rephrasing or ask about travel, prayer, patience, or remembrance.",
        "ur": "میں قرآن، حدیث یا دعاؤں میں اس سوال کا حوالہ شدہ جواب نہیں ڈھونڈ سکا۔ براہ کرم سوال دوسرے الفاظ میں پوچھیں۔",
        "hi": "मैं कुरान, हदीस या दुआओं में इस प्रश्न का उद्धृत उत्तर नहीं ढूंढ सका। कृपया प्रश्न दोबारा पूछें।",
    }
    return messages.get(lang, messages["en"])
