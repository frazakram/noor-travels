from fastapi import APIRouter, HTTPException, Query

from app.db import get_cursor

router = APIRouter()


@router.get("/search")
def search_hadith(q: str = Query(min_length=2)):
    pattern = f"%{q}%"
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT id, collection, chapter_en, hadith_number, arabic, english, reference
            FROM hadiths
            WHERE arabic ILIKE %s OR english ILIKE %s OR chapter_en ILIKE %s
            ORDER BY hadith_number LIMIT 30
            """,
            (pattern, pattern, pattern),
        )
        return {"results": cur.fetchall()}


@router.get("/{hadith_id}")
def get_hadith(hadith_id: int):
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT id, collection, chapter_en, hadith_number, arabic, english, reference
            FROM hadiths WHERE id = %s
            """,
            (hadith_id,),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "Hadith not found")
    return row
