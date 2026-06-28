"""Rule-based answer validation — no LLM cost, runs on every chat response."""
from __future__ import annotations

import re
from typing import Any

from app.services.query_expansion import match_themes, theme_priority

# Per-theme checks: answer (+ sources) must align with the user's intent.
THEME_VALIDATION: dict[str, dict[str, list[str]]] = {
    "fitrah": {
        "must_contain_any": ["fitr", "sa'", "sa ", "dates", "barley", "1451", "eid", "فطر"],
        "must_not_contain_any": ["fasting is ordained", "taqwa (god-consciousness)", "ar-razzaq"],
    },
    "zakat_rate": {
        "must_contain_any": ["2.5", "fortieth", "zakat", "zakah", "1405", "nisab", "چالیس"],
        "must_not_contain_any": ["fasting is ordained", "ar-razzaq", "taqwa (god-consciousness)"],
    },
    "ramadan": {
        "must_contain_any": ["fast", "ramadan", "taqwa", "روزہ", "रमज़ान"],
        "must_not_contain_any": [],
    },
    "travel": {
        "must_contain_any": ["travel", "journey", "safar", "سفر"],
        "must_not_contain_any": [],
    },
    "sleep": {
        "must_contain_any": ["mulk", "ikhlas", "kursi", "sleep", "falaq", "nas"],
        "must_not_contain_any": ["revelation period", "medinan"],
    },
    "study": {
        "must_contain_any": ["knowledge", "learn", "20:114", "علم"],
        "must_not_contain_any": ["travel dua", "journey safety"],
    },
}

QUESTION_TYPE_RULES: list[dict[str, Any]] = [
    {
        "pattern": r"how\s+much|percentage|percent|what\s+rate|how\s+many",
        "must_have_source_types": ["hadith", "quran"],
        "hint": "amount_question_needs_cited_source",
    },
]


def _combined_text(answer: str, sources: list[dict], citations: list[str]) -> str:
    parts = [answer or ""]
    parts.extend(s.get("snippet", "") for s in sources)
    parts.extend(citations)
    return " ".join(parts).lower()


def validate_answer(
    question: str,
    answer: str,
    sources: list[dict],
    analysis: dict[str, Any],
    citations: list[str] | None = None,
) -> dict[str, Any]:
    """
    Returns {valid, issues, confidence, suggested_notice}.
    Uses theme priority so fitrah beats ramadan when both match.
    """
    citations = citations or []
    themes = analysis.get("themes") or [t["id"] for t in match_themes(question)]
    themes = sorted(themes, key=theme_priority, reverse=True)
    combined = _combined_text(answer, sources, citations)
    issues: list[str] = []

    if not answer or len(answer.strip()) < 20:
        issues.append("answer_too_short")

    if not sources and "could not find" not in (answer or "").lower():
        issues.append("no_sources")

    top_score = max((float(s.get("score", 0)) for s in sources), default=0.0)
    if sources and top_score < 0.25:
        issues.append("low_source_score")

    for theme_id in themes[:2]:
        rules = THEME_VALIDATION.get(theme_id)
        if not rules:
            continue
        must = rules.get("must_contain_any") or []
        must_not = rules.get("must_not_contain_any") or []
        if must and not any(m.lower() in combined for m in must):
            issues.append(f"theme_{theme_id}_missing_keywords")
        if must_not and any(m.lower() in combined for m in must_not):
            issues.append(f"theme_{theme_id}_wrong_topic")

    for rule in QUESTION_TYPE_RULES:
        if re.search(rule["pattern"], question, re.I):
            types = {s.get("type", "") for s in sources}
            needed = rule.get("must_have_source_types") or []
            if needed and not any(t in types for t in needed):
                issues.append(rule["hint"])

    # Answer should reference at least one retrieved source ref when making claims
    if sources and answer and "see the sources" not in answer.lower():
        refs = " ".join(s.get("ref", "") for s in sources).lower()
        nums_in_answer = set(re.findall(r"\d+:\d+|\d{3,4}", answer.lower()))
        has_ref_overlap = any(
            ref_part in combined
            for ref in sources
            for ref_part in ref.get("ref", "").lower().split()
            if len(ref_part) > 3
        )
        if nums_in_answer and not has_ref_overlap:
            cited_nums = set(re.findall(r"\d+:\d+|\d{3,4}", refs))
            if nums_in_answer - cited_nums:
                issues.append("uncited_numbers")

    valid = len(issues) == 0
    if valid:
        confidence = "high"
    elif len(issues) <= 2:
        confidence = "medium"
    else:
        confidence = "low"

    notice = None
    if not valid:
        notice = (
            "This answer may not fully match your question. "
            "Please check the cited sources below or rephrase your question."
        )

    return {
        "valid": valid,
        "issues": issues,
        "confidence": confidence,
        "themes_checked": themes[:2],
        "suggested_notice": notice,
    }
