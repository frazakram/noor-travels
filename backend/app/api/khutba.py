import base64
import json
import re

import httpx
from fastapi import APIRouter, HTTPException, Query, Response, WebSocket, WebSocketDisconnect
from openai import OpenAI
from pydantic import BaseModel, Field

from app.core.config import get_settings
from app.db import get_cursor
from app.services.khutba_pdf import KhutbaLine, build_khutba_pdf
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
                WHERE title ILIKE %s OR english_text ILIKE %s
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
    accumulated_ar: str = Field(default="", max_length=8000)


@router.post("/live-chunk")
async def khutba_live_chunk(body: LiveChunkRequest):
    """One ~10s recording segment → Arabic transcript + English/Urdu translation.

    Vercel's serverless runtime drops WebSocket data frames, so the live page
    posts complete recording segments here instead. The client passes back the
    accumulated English text so khutbah matching stays stateless server-side.
    """
    settings = get_settings()
    if not re.sub(r"[^\x21-\x7E]", "", settings.deepgram_api_key):
        raise HTTPException(503, "Transcription unavailable: DEEPGRAM_API_KEY is not set on the server")
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
    try:
        result = json.loads(translation.choices[0].message.content or "{}")
    except ValueError:
        result = {}
    if not isinstance(result, dict):
        result = {}
    english = str(result.get("english", "") or "").strip()
    accumulated_english = f"{body.accumulated} {english}".strip()[-4000:]
    accumulated_arabic = f"{body.accumulated_ar} {transcript.strip()}".strip()[-4000:]

    response: dict = {
        "type": "translation",
        "arabic": result.get("arabic", transcript),
        "english": english,
        "urdu": result.get("urdu", ""),
        "accumulated": accumulated_english,
        "accumulated_ar": accumulated_arabic,
        "match": None,
        "suggestion": None,
    }
    match = match_transcript(accumulated_english, accumulated_arabic)
    if match:
        payload = {
            "slug": match.khutbah.slug,
            "title": match.khutbah.title,
            "source_url": match.khutbah.source_url,
            "score": match.score,
            "matched_phrase": match.matched_phrase,
        }
        # Fuzzy hits are likely-but-not-certain: surface as a tappable
        # suggestion so live listening keeps going.
        response["suggestion" if match.tier == "fuzzy" else "match"] = payload
    return response


class PdfLine(BaseModel):
    arabic: str = Field(default="", max_length=4000)
    english: str = Field(default="", max_length=4000)
    urdu: str = Field(default="", max_length=4000)


class KhutbaPdfRequest(BaseModel):
    """A saved khutba, posted back for rendering.

    Saved sessions live in the browser's localStorage, so the client has to send
    the transcript up to be typeset — the server never stored it.
    """

    title: str = Field(default="Saved Khutba", max_length=300)
    saved_at: str = Field(default="", max_length=64)
    location: str = Field(default="", max_length=200)
    coverage: str = Field(default="", max_length=300)
    lines: list[PdfLine] = Field(min_length=1, max_length=2000)


@router.post("/pdf")
def khutba_pdf(body: KhutbaPdfRequest):
    pdf_bytes = build_khutba_pdf(
        title=body.title.strip() or "Saved Khutba",
        saved_at=body.saved_at,
        location=body.location,
        coverage=body.coverage,
        lines=[KhutbaLine(arabic=l.arabic, english=l.english, urdu=l.urdu) for l in body.lines],
    )
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="khutba.pdf"'},
    )


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
            if match and match.tier == "exact":
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


# Whisper was trained on scraped YouTube subtitles, so on non-speech audio it
# emits subtitle boilerplate at high confidence instead of an empty string.
# nova-3 does not do this, but the filter stays as a backstop for any model.
_HALLUCINATIONS = {
    "اشتركوا في القناة",
    "اشترك في القناة",
    "شكرا للمشاهدة",
    "شكرا على المشاهدة",
    "ترجمة نانسي قنقر",
    "الى اللقاء في الحلقه القادمه",
    "subscribe to the channel",
    "thanks for watching",
}


# Folds the same orthographic variants as khutbah_match.normalize_arabic, but
# keeps ASCII letters too so the English boilerplate can be keyed as well.
_DENY_MARKS = re.compile(r"[ً-ٰٟـۖ-ۭ]")
_DENY_KEEP = re.compile(r"[^ء-يa-z ]")


def _denylist_key(text: str) -> str:
    key = text.strip().lower()
    key = _DENY_MARKS.sub("", key)
    key = re.sub("[أإآٱ]", "ا", key)
    key = key.replace("ى", "ي").replace("ة", "ه")
    key = _DENY_KEEP.sub(" ", key)
    return re.sub(r"\s+", " ", key).strip()


_HALLUCINATIONS_NORM = {_denylist_key(phrase) for phrase in _HALLUCINATIONS}


def _strip_hallucination(transcript: str) -> str:
    """Drop transcripts that are nothing but known subtitle boilerplate.

    Only whole-transcript matches are dropped — a segment that merely contains
    the phrase alongside real speech is kept, so genuine content is never lost.
    """
    stripped = transcript.strip()
    if not stripped:
        return ""
    return "" if _denylist_key(stripped) in _HALLUCINATIONS_NORM else stripped


async def _transcribe_arabic(
    api_key: str, audio_bytes: bytes, content_type: str = "audio/webm"
) -> str:
    # nova-3 is the only Deepgram tier that serves Arabic (nova-2 400s on it).
    # It replaced hosted Whisper here: whisper-medium queued unpredictably —
    # measured 3s at best but 65s+ on ~75% of calls at a 10s request cadence,
    # which permanently backlogs the live page's sequential upload queue.
    # Header values must be printable ASCII with no stray whitespace, or h11
    # raises LocalProtocolError — an empty key yields "Token " (trailing space)
    # and pasted keys can carry zero-width characters, so sanitize both.
    clean_key = re.sub(r"[^\x21-\x7E]", "", api_key)
    clean_ct = re.sub(r"[^\x20-\x7E]", "", content_type).strip() or "audio/webm"
    # nova-3 answers in ~1.7s; a chunk slower than this is never worth the
    # queue backlog it causes, so fail fast and let the next segment through.
    async with httpx.AsyncClient(timeout=15.0) as http:
        resp = await http.post(
            "https://api.deepgram.com/v1/listen",
            params={
                "model": "nova-3",
                "language": "ar",
                "punctuate": "true",
                "smart_format": "true",
            },
            headers={
                "Authorization": f"Token {clean_key}",
                "Content-Type": clean_ct,
            },
            content=audio_bytes,
        )
        resp.raise_for_status()
        payload = resp.json()
        try:
            transcript = payload["results"]["channels"][0]["alternatives"][0]["transcript"]
        except (KeyError, IndexError):
            return ""
        return _strip_hallucination(transcript)
