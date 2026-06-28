"""Text-to-speech: Deepgram (English) + Edge neural voices (Hindi/Urdu)."""
import asyncio
from functools import lru_cache

import httpx

from app.core.config import get_settings

DEEPGRAM_MODELS = {
    "en": "aura-2-thalia-en",
}

EDGE_VOICES = {
    "hi": "hi-IN-SwaraNeural",
    "ur": "ur-PK-UzmaNeural",
    "en": "en-US-JennyNeural",
}


@lru_cache(maxsize=1)
def _edge_tts_available() -> bool:
    try:
        import edge_tts  # noqa: F401

        return True
    except ImportError:
        return False


async def _edge_speak(text: str, voice: str) -> bytes:
    import edge_tts

    audio = bytearray()
    communicate = edge_tts.Communicate(text, voice)
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            audio.extend(chunk["data"])
    return bytes(audio)


def _deepgram_speak(text: str, model: str) -> bytes:
    settings = get_settings()
    with httpx.Client(timeout=60) as client:
        r = client.post(
            "https://api.deepgram.com/v1/speak",
            params={"model": model},
            headers={
                "Authorization": f"Token {settings.deepgram_api_key}",
                "Content-Type": "application/json",
            },
            json={"text": text},
        )
        r.raise_for_status()
        return r.content


async def synthesize_speech(text: str, lang: str) -> tuple[bytes, str]:
    """Return (audio_bytes, content_type)."""
    clean = text.strip()
    if not clean:
        raise ValueError("Empty text")

    lang = lang if lang in ("en", "ur", "hi") else "en"

    if lang == "en":
        try:
            audio = _deepgram_speak(clean, DEEPGRAM_MODELS["en"])
            if len(audio) > 100:
                return audio, "audio/mpeg"
        except Exception:
            pass

    if not _edge_tts_available():
        raise RuntimeError("No TTS backend available for this language")

    voice = EDGE_VOICES.get(lang, EDGE_VOICES["en"])
    audio = await _edge_speak(clean, voice)
    if len(audio) < 100:
        raise RuntimeError("TTS produced empty audio")
    return audio, "audio/mpeg"
