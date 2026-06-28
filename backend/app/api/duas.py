from fastapi import APIRouter, HTTPException

from app.db import get_cursor

router = APIRouter()


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
        return {"duas": cur.fetchall()}


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
        return {"duas": cur.fetchall()}


@router.get("/{dua_id}")
def get_dua(dua_id: str):
    with get_cursor() as cur:
        cur.execute("SELECT * FROM duas WHERE id = %s", (dua_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "Dua not found")
    return row
