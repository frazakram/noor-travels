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
