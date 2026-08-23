from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel, Field

from app.core.limiter import limiter
from app.services.tts_service import synthesize_speech

router = APIRouter()


class SpeakRequest(BaseModel):
    text: str = Field(min_length=1, max_length=4000)
    lang: str = Field(default="en", pattern="^(en|ur|hi)$")


@router.post("/speak")
@limiter.limit("20/minute")
async def speak(request: Request, body: SpeakRequest):
    try:
        audio, content_type = await synthesize_speech(body.text, body.lang)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    except Exception as exc:
        raise HTTPException(502, f"TTS failed ({type(exc).__name__})") from exc

    return Response(content=audio, media_type=content_type)
