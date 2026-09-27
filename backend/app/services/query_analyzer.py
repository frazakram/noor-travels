import json
from typing import Any

from openai import OpenAI

from app.core.config import get_settings

ANALYZER_PROMPT = """You analyze Islamic learning questions for a RAG system (Quran, tafsir, Sahih Bukhari, travel duas).
The user may write in English, Urdu, Hindi, Arabic script, or Roman Urdu/Hindi.

Return JSON only:
{
  "search_queries_en": ["2-4 English search phrases for retrieval"],
  "source_filter": ["quran" and/or "tafsir" and/or "hadith" and/or "dua"],
  "detected_language": "en|ur|hi|ar|roman",
  "intent": "brief intent",
  "standalone_question": "clear English question including chat context"
}

Rules:
- search_queries_en must be in English for embedding search
- source_filter: travel dua → dua; fiqh from hadith → hadith; ayah meaning → quran; tafsir/explanation/commentary → tafsir (often with quran)
- standalone_question merges chat history into one clear question
- Never add sources not in quran, tafsir, hadith, dua"""


def analyze_query(
    client: OpenAI,
    question: str,
    lang: str,
    history: list[dict[str, str]] | None = None,
) -> dict[str, Any]:
    settings = get_settings()
    history_text = ""
    if history:
        tail = history[-4:]
        history_text = "\n".join(f"{m['role']}: {m['content']}" for m in tail)

    response = client.chat.completions.create(
        model=settings.chat_model,
        messages=[
            {"role": "system", "content": ANALYZER_PROMPT},
            {
                "role": "user",
                "content": (
                    f"UI language: {lang}\n"
                    f"Chat history:\n{history_text or '(none)'}\n\n"
                    f"Latest message: {question}"
                ),
            },
        ],
        response_format={"type": "json_object"},
        temperature=0,
        max_tokens=300,
    )
    parsed = json.loads(response.choices[0].message.content or "{}")
    queries = parsed.get("search_queries_en") or [parsed.get("standalone_question") or question]
    if isinstance(queries, str):
        queries = [queries]
    filters = parsed.get("source_filter") or ["quran", "hadith", "dua"]
    return {
        "search_queries_en": [q for q in queries if q][:4],
        "source_filter": [f for f in filters if f in ("quran", "tafsir", "hadith", "dua")],
        "detected_language": parsed.get("detected_language", lang),
        "intent": parsed.get("intent", ""),
        "standalone_question": parsed.get("standalone_question") or question,
    }


REWRITE_PROMPT = """You prepare search input for an Islamic Q&A retriever over three English texts:
the Quran (Sahih International translation), Sahih al-Bukhari (Muhsin Khan translation) and Ibn Kathir's tafsir.
The retriever matches words, so it can only find what you name in THOSE translations' own vocabulary.

Return JSON only:
{
  "follow_up": true or false,
  "standalone": "the current question, rewritten to make sense on its own",
  "concepts": [["main topic word", "its alternatives"], ["another distinct idea"]],
  "phrases": ["1-3 short English phrases describing what the answer is about"],
  "wants": ["quran" and/or "hadith" and/or "tafsir" and/or "dua"]
}

Rules:
- follow_up: true only if the current question refers back to the conversation; a new topic is false.
- standalone: if the current question depends on the conversation ("explain it", "what about women?",
  "why?", "give another hadith"), fold in what it refers to. If it is a new topic, return it unchanged:
  never mix an earlier topic into an unrelated question. Concepts and phrases describe the standalone question.
- concepts: the 1-3 ideas a source must mention to answer the question, most important first.
  The first is what is actually being asked (overslept Fajr -> ["forget", "sleep"], not ["Fajr"]).
  Each concept is a list of 1-4 alternative words for that ONE idea, as different translations might
  word it (["backbite", "slander"], ["fish", "whale"]); a source with any one of them covers the idea.
  Never split synonyms into separate concepts, and leave out framing ideas any passage could contain
  (speech, words, time, rules, people): fewer, sharper concepts find the right text.
- Concept words: the topic itself, not the question's framing. Drop words like written, mentioned, where, allowed, Islam, say.
- Use root/base forms (backbite, forget, sleep, combine), not inflections (backbiting, forgotten, slept).
- Skip generic words (brother, people, good, Allah, prayer) unless they ARE the topic; distinctive words find the right text.
- Use the translations' spellings and names: Jonah (not Yunus), Moses, Abraham, Noah, Joseph, fish (with whale as an alternative),
  Zuhr, Asr, Maghrib, Isha, usury (riba), prostration (sujood), charity/Zakat, Hajj, Umra, fast/fasting (sawm).
- Add the concrete words a relevant verse or hadith would contain (beard -> beard, moustaches; missed prayer -> forgets, sleep, remembers).
- The question may be in Urdu, Hindi, Arabic or Roman script: still answer in English terms."""


def rewrite_for_retrieval(
    client: OpenAI, models: list[str], question: str, history: list[dict[str, str]] | None = None
) -> dict[str, Any] | None:
    """LLM query understanding for retrieval; None when the model is unavailable or returns nothing usable."""
    from app.services.llm import complete

    turns = [
        f"{'User' if h.get('role') == 'user' else 'Assistant'}: {str(h.get('content', ''))[:300]}"
        for h in (history or [])[-4:]
        if h.get("content")
    ]
    content = (
        "Conversation so far:\n" + "\n".join(turns) + f"\n\nCurrent question: {question}" if turns else question
    )

    response = complete(
        client,
        models,
        messages=[
            {"role": "system", "content": REWRITE_PROMPT},
            {"role": "user", "content": content},
        ],
        response_format={"type": "json_object"},
        temperature=0,
        max_tokens=350,
    )
    try:
        parsed = json.loads(response.choices[0].message.content or "{}")
    except ValueError:
        return None
    if not isinstance(parsed, dict):
        return None

    def clean(values: object, limit: int) -> list[str]:
        if not isinstance(values, list):
            return []
        out = [str(v).strip() for v in values if isinstance(v, (str, int)) and str(v).strip()]
        return list(dict.fromkeys(out))[:limit]

    raw_concepts = parsed.get("concepts")
    concepts = [
        group for group in (clean(c, 4) for c in (raw_concepts if isinstance(raw_concepts, list) else [])[:4]) if group
    ]
    keywords = list(dict.fromkeys(word for group in concepts for word in group))[:12]
    if not keywords:
        return None
    wants = [w for w in clean(parsed.get("wants"), 4) if w in ("quran", "hadith", "tafsir", "dua")]
    standalone = parsed.get("standalone")
    standalone = standalone.strip()[:500] if isinstance(standalone, str) and standalone.strip() else question
    return {
        "keywords": keywords,
        "concepts": concepts,
        "phrases": clean(parsed.get("phrases"), 3),
        "wants": wants,
        "standalone": standalone,
        "follow_up": parsed.get("follow_up") is True,
    }
