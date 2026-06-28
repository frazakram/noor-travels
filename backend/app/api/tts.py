from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

from app.services.tts_service import synthesize_speech

router = APIRouter()


class SpeakRequest(BaseModel):
    text: str = Field(min_length=1, max_length=4000)
    lang: str = Field(default="en", pattern="^(en|ur|hi)$")


@router.post("/speak")
async def speak(body: SpeakRequest):
    try:
        audio, content_type = await synthesize_speech(body.text, body.lang)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    except Exception as exc:
        raise HTTPException(502, f"TTS failed: {exc}") from exc

    return Response(content=audio, media_type=content_type)
