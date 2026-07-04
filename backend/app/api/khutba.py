import base64
import json

import httpx
from fastapi import APIRouter, HTTPException, Query, WebSocket, WebSocketDisconnect
from openai import OpenAI
from pydantic import BaseModel, Field

from app.core.config import get_settings
from app.db import get_cursor
from app.services.khutbah_match import match_transcript

router = APIRouter()

TRANSLATE_PROMPT = """Translate this Arabic khutba/sermon excerpt to English and Urdu.
Return JSON only: {"arabic": "...", "english": "...", "urdu": "..."}
Keep religious terms accurate. If unclear, transliterate names."""


def _translation_client_and_model(settings) -> tuple[OpenAI, str]:
    """Prefer Groq (free tier) like the chat service; OpenAI only as fallback."""
    if settings.groq_api_key.strip():
        return (
            OpenAI(api_key=settings.groq_api_key.strip(), base_url="https://api.groq.com/openai/v1"),
            settings.groq_chat_model,
        )
    return OpenAI(api_key=settings.openai_api_key.strip()), settings.chat_model


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


class LiveChunkRequest(BaseModel):
    """Audio travels base64-in-JSON: Vercel's Python runtime corrupts binary
    multipart bodies (text multipart parses fine, binary 500s)."""

    audio_b64: str = Field(min_length=1, max_length=4_000_000)
    content_type: str = "audio/webm"
    accumulated: str = Field(default="", max_length=8000)


@router.post("/live-chunk")
async def khutba_live_chunk(body: LiveChunkRequest):
    """One ~10s recording segment → Arabic transcript + English/Urdu translation.

    Vercel's serverless runtime drops WebSocket data frames, so the live page
    posts complete recording segments here instead. The client passes back the
    accumulated English text so khutbah matching stays stateless server-side.
    """
    settings = get_settings()
    try:
        data = base64.b64decode(body.audio_b64, validate=True)
    except Exception as exc:
        raise HTTPException(400, "Invalid audio encoding") from exc
    if len(data) < 200:
        return {"type": "empty", "message": "No speech detected"}

    try:
        transcript = await _transcribe_arabic(
            settings.deepgram_api_key, data, body.content_type or "audio/webm"
        )
    except httpx.HTTPStatusError as exc:
        raise HTTPException(502, f"Transcription failed ({exc.response.status_code})") from exc
    except Exception as exc:
        raise HTTPException(502, f"Transcription failed ({type(exc).__name__})") from exc
    if not transcript.strip():
        return {"type": "empty", "message": "No speech detected"}

    try:
        client, model = _translation_client_and_model(settings)
        translation = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": TRANSLATE_PROMPT},
                {"role": "user", "content": transcript},
            ],
            response_format={"type": "json_object"},
            temperature=0.2,
        )
    except Exception as exc:
        raise HTTPException(502, f"Translation failed ({type(exc).__name__})") from exc
    result = json.loads(translation.choices[0].message.content or "{}")
    english = result.get("english", "").strip()
    accumulated_english = f"{body.accumulated} {english}".strip()[-4000:]

    response: dict = {
        "type": "translation",
        "arabic": result.get("arabic", transcript),
        "english": english,
        "urdu": result.get("urdu", ""),
        "accumulated": accumulated_english,
        "match": None,
    }
    match = match_transcript(accumulated_english) if accumulated_english else None
    if match:
        response["match"] = {
            "slug": match.khutbah.slug,
            "title": match.khutbah.title,
            "source_url": match.khutbah.source_url,
            "score": match.score,
            "matched_phrase": match.matched_phrase,
        }
    return response


@router.websocket("/live")
async def khutba_live(ws: WebSocket):
    await ws.accept()
    settings = get_settings()
    client, ws_model = _translation_client_and_model(settings)
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
                model=ws_model,
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


async def _transcribe_arabic(
    api_key: str, audio_bytes: bytes, content_type: str = "audio/webm"
) -> str:
    # nova-2 has no Arabic support; Deepgram serves Arabic through hosted Whisper.
    # strip(): env values pasted with a trailing newline make the header illegal.
    async with httpx.AsyncClient(timeout=60.0) as http:
        resp = await http.post(
            "https://api.deepgram.com/v1/listen",
            params={
                "model": "whisper-medium",
                "language": "ar",
                "punctuate": "true",
                "smart_format": "true",
            },
            headers={
                "Authorization": f"Token {api_key.strip()}",
                "Content-Type": content_type.strip() or "audio/webm",
            },
            content=audio_bytes,
        )
        resp.raise_for_status()
        payload = resp.json()
        try:
            return payload["results"]["channels"][0]["alternatives"][0]["transcript"]
        except (KeyError, IndexError):
            return ""
