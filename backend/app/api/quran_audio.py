"""Quran recitation + human translation audio via Al Quran Cloud CDN."""
from functools import lru_cache

import httpx
from fastapi import APIRouter, HTTPException, Query

ALQURAN = "https://api.alquran.cloud/v1"

# Verse-by-verse translation audio (human reciters, not TTS)
TRANSLATION_AUDIO_EDITIONS: dict[str, dict[str, str]] = {
    "en": {
        "id": "en.walk",
        "name": "Ibrahim Walk (English)",
        "source": "alquran.cloud",
    },
    "ur": {
        "id": "ur.khan",
        "name": "Shamshad Ali Khan (Urdu)",
        "source": "alquran.cloud",
    },
}

# EveryAyah mirror (same files as ur.khan) — fallback if CDN path changes
EVERYAYAH_URDU = "https://everyayah.com/data/translations/urdu_shamshad_ali_khan_46kbps/{file}.mp3"

DEFAULT_RECITERS = [
    {"id": "ar.alafasy", "name": "Mishary Alafasy"},
    {"id": "ar.abdurrahmaansudais", "name": "Abdur-Rahman As-Sudais"},
    {"id": "ar.abdulbasitmurattal", "name": "Abdul Basit (Murattal)"},
    {"id": "ar.shaatree", "name": "Abu Bakr Ash-Shatri"},
    {"id": "ar.husary", "name": "Mahmoud Khalil Al-Husary"},
]

router = APIRouter()


@lru_cache(maxsize=1)
def _fetch_audio_editions() -> list[dict]:
    try:
        with httpx.Client(timeout=30) as client:
            r = client.get(f"{ALQURAN}/edition", params={"format": "audio", "language": "ar"})
            r.raise_for_status()
            items = r.json().get("data", [])
            return [
                {
                    "id": e["identifier"],
                    "name": e.get("englishName") or e.get("name", e["identifier"]),
                }
                for e in items
            ]
    except Exception:
        return DEFAULT_RECITERS


def _verse_key_to_everyayah_file(surah_number: int, ayah_number: int) -> str:
    return f"{surah_number:03d}{ayah_number:03d}"


def _everyayah_urdu_url(surah_number: int, ayah_number: int) -> str:
    return EVERYAYAH_URDU.format(file=_verse_key_to_everyayah_file(surah_number, ayah_number))


def _fetch_surah_edition(client: httpx.Client, surah_number: int, edition: str) -> dict:
    r = client.get(f"{ALQURAN}/surah/{surah_number}/{edition}")
    r.raise_for_status()
    return r.json()["data"]


@router.get("/editions")
def list_audio_editions():
    editions = _fetch_audio_editions()
    return {"reciters": editions, "default": "ar.alafasy"}


@router.get("/translation-editions")
def list_translation_audio_editions():
    """Human translation audio available per language (not TTS)."""
    items = []
    for lang, meta in TRANSLATION_AUDIO_EDITIONS.items():
        items.append(
            {
                "lang": lang,
                "id": meta["id"],
                "name": meta["name"],
                "source": meta["source"],
            }
        )
    items.append(
        {
            "lang": "hi",
            "id": None,
            "name": "Hindi — TTS fallback (no verse-by-verse audio CDN found)",
            "source": "tts",
        }
    )
    return {"editions": items}


@router.get("/surahs/{surah_number}")
def get_surah_audio(
    surah_number: int,
    reciter: str = Query("ar.alafasy", min_length=3, max_length=64),
    translation_lang: str | None = Query(None, pattern="^(en|ur|hi)$"),
):
    if not 1 <= surah_number <= 114:
        raise HTTPException(400, "Surah number must be 1–114")

    try:
        with httpx.Client(timeout=45) as client:
            arabic_payload = _fetch_surah_edition(client, surah_number, reciter)
            tr_payload = None
            tr_edition = None
            if translation_lang and translation_lang in TRANSLATION_AUDIO_EDITIONS:
                tr_meta = TRANSLATION_AUDIO_EDITIONS[translation_lang]
                tr_edition = tr_meta["id"]
                tr_payload = _fetch_surah_edition(client, surah_number, tr_edition)
    except httpx.HTTPStatusError as exc:
        raise HTTPException(502, f"Audio source error: {exc.response.status_code}") from exc
    except Exception as exc:
        raise HTTPException(502, "Could not fetch recitation audio") from exc

    edition = arabic_payload.get("edition", {})
    tr_by_num: dict[int, str] = {}
    if tr_payload:
        for ayah in tr_payload.get("ayahs", []):
            num = ayah.get("numberInSurah") or ayah.get("number")
            audio = ayah.get("audio")
            if num and audio:
                tr_by_num[int(num)] = audio

    ayahs = []
    for ayah in arabic_payload.get("ayahs", []):
        num = ayah.get("numberInSurah") or ayah.get("number")
        if not num:
            continue
        num = int(num)
        tr_audio = tr_by_num.get(num)
        if translation_lang == "ur" and not tr_audio:
            tr_audio = _everyayah_urdu_url(surah_number, num)

        ayahs.append(
            {
                "ayah_number": num,
                "verse_key": f"{surah_number}:{num}",
                "audio": ayah.get("audio"),
                "audio_secondary": ayah.get("audioSecondary", []),
                "translation_audio": tr_audio,
            }
        )

    if not ayahs:
        raise HTTPException(404, "No audio for this surah")

    tr_info = None
    if translation_lang:
        if translation_lang in TRANSLATION_AUDIO_EDITIONS:
            tr_info = {
                **TRANSLATION_AUDIO_EDITIONS[translation_lang],
                "fallback": "tts",
            }
        else:
            tr_info = {"lang": "hi", "fallback": "tts", "name": "AI voice (Hindi)"}

    return {
        "surah_number": surah_number,
        "reciter": reciter,
        "reciter_name": edition.get("englishName") or edition.get("name", reciter),
        "translation_lang": translation_lang,
        "translation_edition": tr_edition,
        "translation_audio_info": tr_info,
        "ayahs": ayahs,
    }
