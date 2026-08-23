import re
from html import unescape
from functools import lru_cache
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app.core.limiter import limiter
from app.db import get_cursor

router = APIRouter()

_CACHE_1H = "public, max-age=3600, stale-while-revalidate=86400"
_CACHE_WORDS = "public, max-age=86400, stale-while-revalidate=604800"

QURAN_COM_CHAPTER_WORDS = (
    "https://api.quran.com/api/v4/verses/by_chapter/{chapter}"
    "?words=true&word_fields=text_uthmani,translation,transliteration"
    "&per_page=300&page={page}"
)

# Map our reciter ids → quran.com / qurancdn recitation ids (for word timings).
RECITER_TIMING_IDS: dict[str, int] = {
    "ar.alafasy": 7,
    "ar.alafasy-2": 7,
    "ar.abdulbasitmurattal": 2,
    "ar.abdurrahmaansudais": 3,
    "ar.shaatree": 4,
    "ar.husary": 6,
    "ar.husary-2": 6,
    "ar.husarymujawwad": 6,
    "ar.husarymujawwad-2": 6,
    "ar.minshawi": 5,
    "ar.minshawi-2": 5,
    "ar.minshawimujawwad": 5,
    "ar.mahermuaiqly": 11,
    "ar.mahermuaiqly-2": 11,
    "ar.hudhaify": 9,
    "ar.hudhaify-2": 9,
    "ar.muhammadayyoub": 8,
    "ar.muhammadayyoub-2": 8,
    "ar.muhammadjibreel": 10,
    "ar.muhammadjibreel-2": 10,
}

QURANCDN_TIMINGS = (
    "https://api.qurancdn.com/api/qdc/audio/reciters/{recitation_id}/audio_files"
    "?chapter={chapter}&segments=true"
)
QURANCDN_ALL_DURATIONS = "https://api.qurancdn.com/api/qdc/audio/reciters/{recitation_id}/audio_files"

TRANSLATION_FIELDS = {
    "en": "translation_en",
    "ur": "translation_ur",
    "hi": "translation_hi",
}

TRANSLITERATION_FIELDS = {
    "en": "transliteration",
    "ur": None,
    "hi": "transliteration_hi",
}


@router.get("/surahs")
def list_surahs():
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT number, name_ar, name_en, name_en_translation, revelation_type, ayah_count
            FROM surahs ORDER BY number
            """
        )
        data = cur.fetchall()
    return JSONResponse({"surahs": data}, headers={"Cache-Control": _CACHE_1H})


@router.get("/surahs/{surah_number}")
def get_surah(
    surah_number: int,
    translation: str = Query("en", pattern="^(en|ur|hi)$"),
):
    field = TRANSLATION_FIELDS.get(translation, "translation_en")
    with get_cursor() as cur:
        cur.execute("SELECT * FROM surahs WHERE number = %s", (surah_number,))
        surah = cur.fetchone()
        if not surah:
            raise HTTPException(404, "Surah not found")
        cur.execute(
            f"""
            SELECT surah_number, ayah_number, verse_key, arabic, transliteration,
                   translation_en, translation_ur, translation_hi, transliteration_hi,
                   juz, page, {field} AS translation
            FROM ayahs WHERE surah_number = %s ORDER BY ayah_number
            """,
            (surah_number,),
        )
        ayahs = cur.fetchall()
    return JSONResponse(
        {"surah": surah, "ayahs": ayahs, "translation": translation},
        headers={"Cache-Control": _CACHE_1H},
    )


@router.get("/ayahs/{verse_key}")
def get_ayah(verse_key: str, translation: str = Query("en", pattern="^(en|ur|hi)$")):
    field = TRANSLATION_FIELDS.get(translation, "translation_en")
    with get_cursor() as cur:
        cur.execute(
            f"""
            SELECT a.*, s.name_en, s.name_ar, a.{field} AS translation
            FROM ayahs a JOIN surahs s ON s.number = a.surah_number
            WHERE a.verse_key = %s
            """,
            (verse_key,),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "Ayah not found")
    return row


@router.get("/ayahs/{verse_key}/tafsir")
def get_tafsir(
    verse_key: str,
    source: str = Query(
        "ibn_kathir_en",
        pattern="^(ibn_kathir_en|maududi_ur|maududi_ur_pdf)$",
    ),
):
    with get_cursor() as cur:
        cur.execute(
            "SELECT verse_key, source, text FROM tafsir WHERE verse_key = %s AND source = %s",
            (verse_key, source),
        )
        row = cur.fetchone()
        if row:
            return row

    # Fallback: Ibn Kathir ingested into document_chunks (production path)
    if source == "ibn_kathir_en":
        ref = f"Tafsir Ibn Kathir {verse_key}"
        with get_cursor() as cur:
            cur.execute(
                "SELECT content FROM document_chunks WHERE source_ref = %s AND source_type = 'tafsir'",
                (ref,),
            )
            chunk = cur.fetchone()
        if chunk:
            content = chunk["content"] if isinstance(chunk, dict) else chunk[0]
            text = re.sub(r"^Tafsir Ibn Kathir\s+[\d:]+\s*\n?", "", content, count=1).strip()
            text = unescape(re.sub(r"<[^>]+>", " ", text))
            text = re.sub(r"\s{2,}", " ", text).strip()
            if text:
                return {"verse_key": verse_key, "source": source, "text": text}

    raise HTTPException(404, "Tafsir not found for this ayah")


@router.get("/search")
def search_quran(q: str = Query(min_length=2)):
    pattern = f"%{q}%"
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT verse_key, surah_number, ayah_number, arabic, transliteration,
                   translation_en, translation_ur, translation_hi
            FROM ayahs
            WHERE arabic ILIKE %s OR transliteration ILIKE %s
               OR translation_en ILIKE %s OR translation_ur ILIKE %s
               OR translation_hi ILIKE %s OR transliteration_hi ILIKE %s
            ORDER BY surah_number, ayah_number LIMIT 30
            """,
            (pattern, pattern, pattern, pattern, pattern, pattern),
        )
        return {"results": cur.fetchall()}


class IdentifyRequest(BaseModel):
    """Text extracted client-side (Tesseract.js OCR, possibly user-edited) from a
    screenshot — Arabic and/or English. No image ever reaches the backend."""

    text: str = Field(min_length=3, max_length=1500)


@router.post("/identify")
@limiter.limit("20/minute")
def identify_verse(request: Request, body: IdentifyRequest):
    """Match OCR'd screenshot text to its source surah:ayah. No LLM anywhere in this
    path — Arabic uses fuzzy text matching, English uses embeddings, both grounded
    in the actual Quran tables (see app/services/quran_identify.py).

    Import is deliberately lazy (not at module top level): quran_identify imports
    numpy, and this router is imported eagerly at app startup — a missing/broken
    numpy install must only break this one endpoint, not crash the whole app and
    take down every unrelated route with it (this happened once already)."""
    from app.services import quran_identify

    return quran_identify.identify(body.text)


def _normalize_word(w: dict[str, Any]) -> dict[str, str] | None:
    if w.get("char_type_name") == "end":
        return None
    ar = (w.get("text_uthmani") or w.get("text") or "").strip()
    if not ar:
        return None
    tr = ((w.get("transliteration") or {}).get("text") or "").strip()
    en = ((w.get("translation") or {}).get("text") or "").strip()
    return {"ar": ar, "tr": tr, "en": en}


@lru_cache(maxsize=128)
def _fetch_surah_words(surah_number: int) -> tuple[tuple[str, tuple[tuple[str, str, str], ...]], ...]:
    """Cached word glosses per ayah for a surah (immutable tuple for lru_cache)."""
    ayahs: list[tuple[str, tuple[tuple[str, str, str], ...]]] = []
    page = 1
    with httpx.Client(timeout=45) as client:
        while True:
            url = QURAN_COM_CHAPTER_WORDS.format(chapter=surah_number, page=page)
            r = client.get(url, headers={"User-Agent": "NoorSafar/1.0"})
            r.raise_for_status()
            data = r.json()
            verses = data.get("verses") or []
            if not verses:
                break
            for v in verses:
                key = v.get("verse_key") or ""
                words: list[tuple[str, str, str]] = []
                for w in v.get("words") or []:
                    nw = _normalize_word(w)
                    if nw:
                        words.append((nw["ar"], nw["tr"], nw["en"]))
                ayahs.append((key, tuple(words)))
            pag = data.get("pagination") or {}
            if not pag.get("next_page"):
                break
            page = int(pag["next_page"])
            if page > 20:
                break
    return tuple(ayahs)


@router.get("/surahs/{surah_number}/words")
def get_surah_words(surah_number: int):
    """Word-by-word Arabic + English gloss for hover tooltips and highlighting."""
    if not 1 <= surah_number <= 114:
        raise HTTPException(400, "Surah number must be 1–114")
    try:
        raw = _fetch_surah_words(surah_number)
    except Exception as exc:
        raise HTTPException(502, "Could not fetch word-by-word data") from exc

    ayahs = [
        {
            "verse_key": key,
            "words": [{"ar": ar, "tr": tr, "en": en} for ar, tr, en in words],
        }
        for key, words in raw
    ]
    return JSONResponse(
        {"surah_number": surah_number, "ayahs": ayahs},
        headers={"Cache-Control": _CACHE_WORDS},
    )


@lru_cache(maxsize=64)
def _fetch_word_timings(surah_number: int, recitation_id: int) -> tuple[tuple[str, int, int, tuple[tuple[int, int, int], ...]], ...]:
    """Per-ayah word segments as (verse_key, ts_from, ts_to, segments) with segments relative to ayah start."""
    url = QURANCDN_TIMINGS.format(recitation_id=recitation_id, chapter=surah_number)
    with httpx.Client(timeout=45) as client:
        r = client.get(url, headers={"User-Agent": "NoorSafar/1.0"})
        r.raise_for_status()
        data = r.json()
    files = data.get("audio_files") or []
    if not files:
        return tuple()
    timings = files[0].get("verse_timings") or []
    out: list[tuple[str, int, int, tuple[tuple[int, int, int], ...]]] = []
    for vt in timings:
        key = vt.get("verse_key") or ""
        base = int(vt.get("timestamp_from") or 0)
        end = int(vt.get("timestamp_to") or base)
        segs: list[tuple[int, int, int]] = []
        for seg in vt.get("segments") or []:
            if not isinstance(seg, list) or len(seg) < 3:
                continue
            try:
                idx = int(seg[0])
                start = max(0, int(seg[1]) - base)
                end_ms = max(start, int(seg[2]) - base)
            except (TypeError, ValueError):
                continue
            segs.append((idx, start, end_ms))
        out.append((key, base, end, tuple(segs)))
    return tuple(out)


@router.get("/surahs/{surah_number}/word-timings")
def get_word_timings(
    surah_number: int,
    reciter: str = Query("ar.alafasy", min_length=3, max_length=64),
):
    """Word timing segments (ms from ayah start) when available for the reciter."""
    if not 1 <= surah_number <= 114:
        raise HTTPException(400, "Surah number must be 1–114")
    rid = RECITER_TIMING_IDS.get(reciter)
    if not rid:
        return JSONResponse(
            {
                "surah_number": surah_number,
                "reciter": reciter,
                "available": False,
                "ayahs": [],
            },
            headers={"Cache-Control": _CACHE_WORDS},
        )
    try:
        raw = _fetch_word_timings(surah_number, rid)
    except Exception as exc:
        raise HTTPException(502, "Could not fetch word timings") from exc

    ayahs = [
        {
            "verse_key": key,
            "timestamp_from": ts_from,
            "timestamp_to": ts_to,
            "segments": [
                {"word_index": idx, "start_ms": start, "end_ms": end}
                for idx, start, end in segs
            ],
        }
        for key, ts_from, ts_to, segs in raw
    ]
    return JSONResponse(
        {
            "surah_number": surah_number,
            "reciter": reciter,
            "available": bool(ayahs),
            "ayahs": ayahs,
        },
        headers={"Cache-Control": _CACHE_WORDS},
    )


@lru_cache(maxsize=32)
def _fetch_all_durations(recitation_id: int) -> tuple[tuple[int, int], ...]:
    """(chapter_id, duration_ms) for all 114 chapters, from the real recording."""
    url = QURANCDN_ALL_DURATIONS.format(recitation_id=recitation_id)
    with httpx.Client(timeout=45) as client:
        r = client.get(url, headers={"User-Agent": "NoorSafar/1.0"})
        r.raise_for_status()
        data = r.json()
    files = data.get("audio_files") or []
    return tuple(
        (int(f["chapter_id"]), int(f.get("duration") or 0))
        for f in files
        if f.get("chapter_id")
    )


@router.get("/durations")
def get_surah_durations(reciter: str = Query("ar.alafasy", min_length=3, max_length=64)):
    """Per-surah recitation length (seconds) for every surah, sourced from the
    reciter's actual recording. Reciters without timing data fall back to
    Alafasy's recording, same convention as word-timings borrowing."""
    rid = RECITER_TIMING_IDS.get(reciter)
    is_fallback = rid is None
    if rid is None:
        rid = RECITER_TIMING_IDS["ar.alafasy"]
    try:
        raw = _fetch_all_durations(rid)
    except Exception as exc:
        raise HTTPException(502, "Could not fetch recitation durations") from exc

    durations = {str(chapter): round(ms / 1000) for chapter, ms in raw if ms > 0}
    return JSONResponse(
        {"reciter": reciter, "is_fallback": is_fallback, "durations": durations},
        headers={"Cache-Control": _CACHE_WORDS},
    )