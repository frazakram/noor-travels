import re
from html import unescape

from fastapi import APIRouter, HTTPException, Query

from app.db import get_cursor

router = APIRouter()

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
        return {"surahs": cur.fetchall()}


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
    return {"surah": surah, "ayahs": ayahs, "translation": translation}


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
        if not row:
            raise HTTPException(404, "Tafsir not found for this ayah")
    return row


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
