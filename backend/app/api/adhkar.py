from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

from app.db import get_cursor

router = APIRouter()

_CACHE_1H = "public, max-age=3600, stale-while-revalidate=86400"

_VALID_CATEGORIES = {"morning", "evening", "night"}


@router.get("/")
def list_adhkar():
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT id, category, order_index, title_en, title_ur, title_hi,
                   arabic, transliteration, translation_en, translation_ur, translation_hi,
                   source, repeat_count, verse_keys
            FROM adhkar ORDER BY category, order_index
            """
        )
        data = cur.fetchall()
    return JSONResponse({"adhkar": data}, headers={"Cache-Control": _CACHE_1H})


@router.get("/{category}")
def list_adhkar_by_category(category: str):
    if category not in _VALID_CATEGORIES:
        raise HTTPException(404, "Unknown adhkar category")
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT id, category, order_index, title_en, title_ur, title_hi,
                   arabic, transliteration, translation_en, translation_ur, translation_hi,
                   source, repeat_count, verse_keys
            FROM adhkar WHERE category = %s ORDER BY order_index
            """,
            (category,),
        )
        data = cur.fetchall()
    return JSONResponse({"adhkar": data}, headers={"Cache-Control": _CACHE_1H})
