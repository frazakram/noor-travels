from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse

from app.db import get_cursor

router = APIRouter()

_CACHE_1H = "public, max-age=3600, stale-while-revalidate=86400"


@router.get("/chapters")
def list_chapters():
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT chapter_en, COUNT(*) AS count
            FROM hadiths
            GROUP BY chapter_en
            ORDER BY chapter_en
            """
        )
        data = cur.fetchall()
    return JSONResponse({"chapters": data}, headers={"Cache-Control": _CACHE_1H})


@router.get("/browse")
def browse_hadith(
    chapter: str = Query(min_length=2),
    limit: int = Query(default=40, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT id, collection, chapter_en, hadith_number, arabic, english, reference
            FROM hadiths
            WHERE chapter_en = %s
            ORDER BY hadith_number
            LIMIT %s OFFSET %s
            """,
            (chapter, limit, offset),
        )
        rows = cur.fetchall()
        cur.execute(
            "SELECT COUNT(*) AS total FROM hadiths WHERE chapter_en = %s",
            (chapter,),
        )
        total = cur.fetchone()["total"]
    if not rows and offset == 0:
        raise HTTPException(404, "Chapter not found")
    return {"results": rows, "total": total, "chapter": chapter}


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
