import base64
import json

import httpx
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from openai import OpenAI

from app.core.config import get_settings

router = APIRouter()

TRANSLATE_PROMPT = """Translate this Arabic khutba/sermon excerpt to English and Urdu.
Return JSON only: {"arabic": "...", "english": "...", "urdu": "..."}
Keep religious terms accurate. If unclear, transliterate names."""


@router.websocket("/live")
async def khutba_live(ws: WebSocket):
    await ws.accept()
    settings = get_settings()
    client = OpenAI(api_key=settings.openai_api_key)

    try:
        while True:
            data = await ws.receive_bytes()
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
            await ws.send_json(
                {
                    "type": "translation",
                    "arabic": result.get("arabic", transcript),
                    "english": result.get("english", ""),
                    "urdu": result.get("urdu", ""),
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
