from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

from app.db import get_cursor

router = APIRouter()

_CACHE_1H = "public, max-age=3600, stale-while-revalidate=86400"


@router.get("/")
def list_duas():
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT id, title_en, title_ur, title_hi, arabic, transliteration,
                   translation_en, translation_ur, translation_hi, source, category
            FROM duas ORDER BY id
            """
        )
        data = cur.fetchall()
    return JSONResponse({"duas": data}, headers={"Cache-Control": _CACHE_1H})


@router.get("/travel")
def travel_duas():
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT id, title_en, title_ur, title_hi, arabic, transliteration,
                   translation_en, translation_ur, translation_hi, source, category
            FROM duas WHERE category = 'travel' ORDER BY id
            """
        )
        data = cur.fetchall()
    return JSONResponse({"duas": data}, headers={"Cache-Control": _CACHE_1H})


@router.get("/{dua_id}")
def get_dua(dua_id: str):
    with get_cursor() as cur:
        cur.execute("SELECT * FROM duas WHERE id = %s", (dua_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "Dua not found")
    return row
