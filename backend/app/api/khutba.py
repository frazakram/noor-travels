import json

import httpx
from fastapi import APIRouter, HTTPException, Query, WebSocket, WebSocketDisconnect
from openai import OpenAI

from app.core.config import get_settings
from app.db import get_cursor
from app.services.khutbah_match import match_transcript

router = APIRouter()

TRANSLATE_PROMPT = """Translate this Arabic khutba/sermon excerpt to English and Urdu.
Return JSON only: {"arabic": "...", "english": "...", "urdu": "..."}
Keep religious terms accurate. If unclear, transliterate names."""


@router.get("/sermons")
def list_sermons(q: str = Query(default="", min_length=0)):
    with get_cursor() as cur:
        if q.strip():
            pattern = f"%{q.strip()}%"
            cur.execute(
                """
                SELECT id, slug, title, source_url
                FROM preloaded_khutbahs
                WHERE title LIKE %s OR english_text LIKE %s
                ORDER BY title
                LIMIT 50
                """,
                (pattern, pattern),
            )
        else:
            cur.execute(
                """
                SELECT id, slug, title, source_url
                FROM preloaded_khutbahs
                ORDER BY title
                """
            )
        rows = cur.fetchall()
    return {"sermons": rows}


@router.get("/sermons/{slug}")
def get_sermon(slug: str):
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT id, slug, title, source_url, english_text
            FROM preloaded_khutbahs
            WHERE slug = %s
            """,
            (slug,),
        )
        row = cur.fetchone()
    if not row:
        raise HTTPException(404, "Khutbah not found")
    return row


@router.get("/match")
def match_sermon(q: str = Query(min_length=8)):
    result = match_transcript(q)
    if not result:
        return {"match": None}
    k = result.khutbah
    return {
        "match": {
            "id": k.id,
            "slug": k.slug,
            "title": k.title,
            "source_url": k.source_url,
            "score": result.score,
            "matched_phrase": result.matched_phrase,
        }
    }


@router.websocket("/live")
async def khutba_live(ws: WebSocket):
    await ws.accept()
    settings = get_settings()
    client = OpenAI(api_key=settings.openai_api_key)
    accumulated_english = ""
    matched_slug: str | None = None

    try:
        while True:
            data = await ws.receive_bytes()
            if matched_slug:
                continue

            transcript = await _transcribe_arabic(settings.deepgram_api_key, data)
            if not transcript.strip():
                await ws.send_json({"type": "empty", "message": "No speech detected"})
                continue

            translation = client.chat.completions.create(
                model=settings.chat_model,
                messages=[
                    {"role": "system", "content": TRANSLATE_PROMPT},
                    {"role": "user", "content": transcript},
                ],
                response_format={"type": "json_object"},
                temperature=0.2,
            )
            result = json.loads(translation.choices[0].message.content or "{}")
            english = result.get("english", "").strip()
            if english:
                accumulated_english = f"{accumulated_english} {english}".strip()

            await ws.send_json(
                {
                    "type": "translation",
                    "arabic": result.get("arabic", transcript),
                    "english": english,
                    "urdu": result.get("urdu", ""),
                }
            )

            match = match_transcript(accumulated_english)
            if match:
                matched_slug = match.khutbah.slug
                await ws.send_json(
                    {
                        "type": "matched",
                        "slug": match.khutbah.slug,
                        "title": match.khutbah.title,
                        "source_url": match.khutbah.source_url,
                        "score": match.score,
                        "matched_phrase": match.matched_phrase,
                    }
                )
    except WebSocketDisconnect:
        pass


async def _transcribe_arabic(api_key: str, audio_bytes: bytes) -> str:
    async with httpx.AsyncClient(timeout=60.0) as http:
        resp = await http.post(
            "https://api.deepgram.com/v1/listen",
            params={
                "model": "nova-2",
                "language": "ar",
                "punctuate": "true",
                "smart_format": "true",
            },
            headers={
                "Authorization": f"Token {api_key}",
                "Content-Type": "audio/webm",
            },
            content=audio_bytes,
        )
        resp.raise_for_status()
        payload = resp.json()
        try:
            return payload["results"]["channels"][0]["alternatives"][0]["transcript"]
        except (KeyError, IndexError):
            return ""
