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
  "keywords": ["3-8 single words or short terms"],
  "phrases": ["1-3 short English phrases describing what the answer is about"],
  "wants": ["quran" and/or "hadith" and/or "tafsir" and/or "dua"]
}

Rules:
- keywords: the topic itself, not the question's framing. Drop words like written, mentioned, where, allowed, Islam, say.
- Use root/base forms (backbite, forget, sleep, combine), not inflections (backbiting, forgotten, slept).
- Skip generic words (brother, people, good, Allah, prayer) unless they ARE the topic; distinctive words find the right text.
- Use the translations' spellings and names: Jonah (not Yunus), Moses, Abraham, Noah, Joseph, fish (not whale),
  Zuhr, Asr, Maghrib, Isha, usury (riba), prostration (sujood), charity/Zakat, Hajj, Umra, fast/fasting (sawm).
- Add the concrete words a relevant verse or hadith would contain (beard -> beard, moustaches; missed prayer -> forgets, sleep, remembers).
- The question may be in Urdu, Hindi, Arabic or Roman script: still answer in English terms."""


def rewrite_for_retrieval(client: OpenAI, models: list[str], question: str) -> dict[str, list[str]] | None:
    """LLM query understanding for retrieval; None when the model is unavailable or returns nothing usable."""
    from app.services.llm import complete

    response = complete(
        client,
        models,
        messages=[
            {"role": "system", "content": REWRITE_PROMPT},
            {"role": "user", "content": question},
        ],
        response_format={"type": "json_object"},
        temperature=0,
        max_tokens=300,
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

    keywords = clean(parsed.get("keywords"), 8)
    if not keywords:
        return None
    wants = [w for w in clean(parsed.get("wants"), 4) if w in ("quran", "hadith", "tafsir", "dua")]
    return {"keywords": keywords, "phrases": clean(parsed.get("phrases"), 3), "wants": wants}
