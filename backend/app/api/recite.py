"""Recitation practice: transcribe the user's recitation and score it against
the Quran text with word-level mistakes.

Scoring is deterministic (normalized word alignment) — no free-form religious
text is generated, in keeping with the retrieval-grounded-only policy.
"""

import base64
import re
from difflib import SequenceMatcher

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.api.khutba import _transcribe_arabic
from app.core.config import get_settings
from app.db import get_cursor

router = APIRouter()

MAX_RANGE_AYAHS = 15
CLOSE_MATCH_RATIO = 0.66

# Marks stripped before comparison: harakat, Quranic annotation signs,
# superscript alef, tatweel, small high/low marks.
_MARKS = re.compile("[ؐ-ًؚ-ٰٟۖ-ۭۥۦـ࣓-ࣿ]")
_ALEF_FORMS = re.compile("[آأإٱ]")
_NON_ARABIC = re.compile("[^ء-ي ]")

# Uthmani "بِسْمِ ٱللَّهِ ..." prefix on ayah 1 (mirrors frontend stripLeadingBismillah).
_BISMILLAH_NORM = ["بسم", "الله", "الرحمن", "الرحيم"]


def normalize_arabic(text: str) -> str:
    """Fold Uthmani orthography and diacritics so the Quran text and Whisper's
    plain transcription compare on equal footing."""
    # Uthmani long-a spellings: الصلوٰة → الصلاة, موسىٰ keeps its alef maqsura.
    t = text.replace("وٰ", "ا")  # وٰ → ا
    t = t.replace("ىٰ", "ى")  # ىٰ → ى
    t = _MARKS.sub("", t)
    t = _ALEF_FORMS.sub("ا", t)
    t = t.replace("ى", "ي")  # ى → ي
    t = t.replace("ة", "ه")  # ة → ه
    t = _NON_ARABIC.sub(" ", t)
    return re.sub(r"\s+", " ", t).strip()


def _word_ratio(a: str, b: str) -> float:
    return SequenceMatcher(None, a, b).ratio()


def _same_word(a: str, b: str) -> bool:
    """Equal ignoring alef: Uthmani dagger-alef spellings (ٱلْعَـٰلَمِينَ) lose
    their alef in normalization while Whisper writes the modern form with a
    plain alef — an orthography gap, not a recitation mistake."""
    return a == b or a.replace("ا", "") == b.replace("ا", "")


def _strip_leading_bismillah(words: list[str]) -> list[str]:
    """Drop a leading Bismillah from normalized words (recited or printed)."""
    if len(words) < 4:
        return words
    hits = sum(
        1 for w, b in zip(words[:4], _BISMILLAH_NORM) if _word_ratio(w, b) >= 0.7
    )
    return words[4:] if hits >= 3 else words


class ScoreRequest(BaseModel):
    """Audio travels base64-in-JSON: Vercel's Python runtime corrupts binary
    multipart bodies (same constraint as the khutba live endpoint)."""

    audio_b64: str = Field(min_length=1, max_length=6_000_000)
    content_type: str = "audio/webm"
    surah: int = Field(ge=1, le=114)
    ayah_start: int = Field(ge=1, le=286)
    ayah_end: int = Field(ge=1, le=286)


@router.post("/score")
async def score_recitation(body: ScoreRequest):
    settings = get_settings()
    if not re.sub(r"[^\x21-\x7E]", "", settings.deepgram_api_key):
        raise HTTPException(503, "Transcription unavailable: DEEPGRAM_API_KEY is not set on the server")
    if body.ayah_end < body.ayah_start:
        raise HTTPException(400, "ayah_end must be >= ayah_start")
    if body.ayah_end - body.ayah_start + 1 > MAX_RANGE_AYAHS:
        raise HTTPException(400, f"Choose at most {MAX_RANGE_AYAHS} ayahs per attempt")

    try:
        data = base64.b64decode(body.audio_b64, validate=True)
    except Exception as exc:
        raise HTTPException(400, "Invalid audio encoding") from exc
    if len(data) < 200:
        return {"type": "empty"}

    with get_cursor() as cur:
        cur.execute(
            """
            SELECT ayah_number, verse_key, arabic
            FROM ayahs
            WHERE surah_number = %s AND ayah_number BETWEEN %s AND %s
            ORDER BY ayah_number
            """,
            (body.surah, body.ayah_start, body.ayah_end),
        )
        rows = cur.fetchall()
    if not rows:
        raise HTTPException(404, "Ayahs not found")

    # Expected words with verse attribution; drop tokens that normalize away
    # (sajdah signs etc.). Ayah 1 of most surahs carries a printed Bismillah.
    expected: list[dict] = []
    for row in rows:
        arabic = row["arabic"] or ""
        raw_words = [w for w in arabic.split() if w.strip()]
        norm_words = [normalize_arabic(w) for w in raw_words]
        pairs = [
            {"verse_key": row["verse_key"], "word": raw, "norm": norm}
            for raw, norm in zip(raw_words, norm_words)
            if norm
        ]
        if (
            body.surah not in (1, 9)
            and row["ayah_number"] == 1
            and len(pairs) >= 4
            and sum(
                1
                for p, b in zip(pairs[:4], _BISMILLAH_NORM)
                if _word_ratio(p["norm"], b) >= 0.7
            )
            >= 3
        ):
            pairs = pairs[4:]
        expected.extend(pairs)
    if not expected:
        raise HTTPException(404, "No scoreable text for this selection")

    try:
        transcript = await _transcribe_arabic(
            settings.deepgram_api_key, data, body.content_type or "audio/webm"
        )
    except httpx.HTTPStatusError as exc:
        raise HTTPException(502, f"Transcription failed ({exc.response.status_code})") from exc
    except Exception as exc:
        raise HTTPException(502, f"Transcription failed ({type(exc).__name__})") from exc
    heard = [w for w in normalize_arabic(transcript).split() if w]
    # An unprompted Bismillah before the selection is fine, never a mistake.
    if body.surah != 1 and body.ayah_start == 1:
        heard = _strip_leading_bismillah(heard)
    if not heard:
        return {"type": "empty"}

    # Word-level alignment between what the text says and what was recited.
    expected_norms = [p["norm"] for p in expected]
    sm = SequenceMatcher(a=expected_norms, b=heard, autojunk=False)
    statuses: list[dict] = [
        {"verse_key": p["verse_key"], "word": p["word"], "status": "missed", "heard": None}
        for p in expected
    ]
    extras: list[str] = []
    credit = 0.0
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == "equal":
            for k in range(i2 - i1):
                statuses[i1 + k]["status"] = "correct"
                credit += 1.0
        elif tag == "replace":
            span_e, span_h = i2 - i1, j2 - j1
            for k in range(max(span_e, span_h)):
                ei = i1 + k if k < span_e else None
                hj = j1 + k if k < span_h else None
                if ei is not None and hj is not None:
                    if _same_word(expected_norms[ei], heard[hj]):
                        statuses[ei]["status"] = "correct"
                        credit += 1.0
                    elif _word_ratio(expected_norms[ei], heard[hj]) >= CLOSE_MATCH_RATIO:
                        statuses[ei]["status"] = "close"
                        credit += 0.8
                        statuses[ei]["heard"] = heard[hj]
                    else:
                        statuses[ei]["status"] = "wrong"
                        statuses[ei]["heard"] = heard[hj]
                elif hj is not None:
                    extras.append(heard[hj])
                # ei without hj keeps its "missed" default.
        elif tag == "insert":
            extras.extend(heard[j1:j2])
        # "delete" keeps the "missed" default.

    total = len(expected)
    correct = sum(1 for s in statuses if s["status"] == "correct")
    close = sum(1 for s in statuses if s["status"] == "close")
    wrong = sum(1 for s in statuses if s["status"] == "wrong")
    missed = sum(1 for s in statuses if s["status"] == "missed")
    base = 10.0 * credit / total
    extra_penalty = min(2.0, 0.15 * len(extras))
    score = max(0.0, round(base - extra_penalty, 1))

    return {
        "type": "score",
        "score": score,
        "transcript": transcript.strip(),
        "total_words": total,
        "correct_words": correct,
        "close_words": close,
        "wrong_words": wrong,
        "missed_words": missed,
        "extra_words": len(extras),
        "extras": extras[:30],
        "words": statuses,
    }
