"""Quran recitation + human translation audio via Al Quran Cloud CDN."""
import re
import urllib.request
from functools import lru_cache
from typing import Any

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
    {"id": "ar.yasseraldossary", "name": "Yasir Al-Dawsari"},
    {"id": "ar.anasibnsalihalmalik", "name": "Anas ibn Salih Al-Malik"},
    {"id": "ar.abdurrahmaansudais", "name": "Abdur-Rahman As-Sudais"},
    {"id": "ar.abdulbasitmurattal", "name": "Abdul Basit (Murattal)"},
    {"id": "ar.shaatree", "name": "Abu Bakr Ash-Shatri"},
    {"id": "ar.husary", "name": "Mahmoud Khalil Al-Husary"},
]

# Reciters not on alquran.cloud — served from EveryAyah or Way2Quran CDN
CUSTOM_AUDIO_RECITERS: dict[str, dict[str, Any]] = {
    "ar.yasseraldossary": {
        "name": "Yasir Al-Dawsari",
        "source": "everyayah",
        "playback_mode": "ayah",
        "everyayah_path": "Yasser_Ad-Dussary_128kbps",
    },
    "ar.anasibnsalihalmalik": {
        "name": "Anas ibn Salih Al-Malik",
        "source": "way2quran",
        "playback_mode": "surah",
        "way2quran_slug": "anas-bin-saleh-al-malik",
        "way2quran_riwaya": "hafs-an-asim",
    },
}

EVERYAYAH_ARABIC = "https://everyayah.com/data/{path}/{file}.mp3"
WAY2QURAN_SURAH = "https://media.way2quran.com/{slug}/{riwaya}/{surah}.mp3"
WAY2QURAN_RECITER_PAGE = "https://way2quran.com/reciters/{slug}"

router = APIRouter()


@lru_cache(maxsize=1)
def _fetch_audio_editions() -> list[dict]:
    editions: list[dict] = []
    try:
        with httpx.Client(timeout=30) as client:
            r = client.get(f"{ALQURAN}/edition", params={"format": "audio", "language": "ar"})
            r.raise_for_status()
            items = r.json().get("data", [])
            editions = [
                {
                    "id": e["identifier"],
                    "name": e.get("englishName") or e.get("name", e["identifier"]),
                }
                for e in items
            ]
    except Exception:
        editions = list(DEFAULT_RECITERS)

    known = {e["id"] for e in editions}
    insert_at = 1
    for rid, meta in CUSTOM_AUDIO_RECITERS.items():
        if rid not in known:
            editions.insert(min(insert_at, len(editions)), {"id": rid, "name": meta["name"]})
            insert_at += 1
    return editions


def _verse_key_to_everyayah_file(surah_number: int, ayah_number: int) -> str:
    return f"{surah_number:03d}{ayah_number:03d}"


def _everyayah_urdu_url(surah_number: int, ayah_number: int) -> str:
    return EVERYAYAH_URDU.format(file=_verse_key_to_everyayah_file(surah_number, ayah_number))


def _everyayah_arabic_url(path: str, surah_number: int, ayah_number: int) -> str:
    file = _verse_key_to_everyayah_file(surah_number, ayah_number)
    return EVERYAYAH_ARABIC.format(path=path, file=file)


def _way2quran_surah_url(slug: str, riwaya: str, surah_number: int) -> str:
    return WAY2QURAN_SURAH.format(slug=slug, riwaya=riwaya, surah=surah_number)


@lru_cache(maxsize=8)
def _way2quran_available_surahs(slug: str, riwaya: str) -> frozenset[int]:
    """Discover which surahs Way2Quran hosts for a reciter (cached)."""
    pattern = re.compile(
        rf'surahNumber\\":(\d+),\\"url\\":\\"https://media\.way2quran\.com/{re.escape(slug)}/{re.escape(riwaya)}/\d+\.mp3\\"'
    )
    found: set[int] = set()
    base = WAY2QURAN_RECITER_PAGE.format(slug=slug)
    for page in (1, 2, 3):
        url = base if page == 1 else f"{base}?page={page}"
        try:
            req = urllib.request.Request(
                url,
                headers={"User-Agent": "Mozilla/5.0 (compatible; NoorSafar/1.0)"},
            )
            with urllib.request.urlopen(req, timeout=25) as resp:
                html = resp.read().decode("utf-8", "replace")
        except Exception:
            continue
        for num in pattern.findall(html):
            found.add(int(num))
    return frozenset(found)


def _translation_payload(
    client: httpx.Client,
    surah_number: int,
    translation_lang: str | None,
) -> tuple[dict[int, str], str | None, dict | None]:
    tr_by_num: dict[int, str] = {}
    tr_edition = None
    tr_info = None
    if translation_lang and translation_lang in TRANSLATION_AUDIO_EDITIONS:
        tr_meta = TRANSLATION_AUDIO_EDITIONS[translation_lang]
        tr_edition = tr_meta["id"]
        tr_payload = _fetch_surah_edition(client, surah_number, tr_edition)
        for ayah in tr_payload.get("ayahs", []):
            num = ayah.get("numberInSurah") or ayah.get("number")
            audio = ayah.get("audio")
            if num and audio:
                tr_by_num[int(num)] = audio
        tr_info = {**tr_meta, "fallback": "tts"}
    elif translation_lang:
        tr_info = {"lang": "hi", "fallback": "tts", "name": "AI voice (Hindi)"}
    return tr_by_num, tr_edition, tr_info


def _fetch_surah_custom(
    client: httpx.Client,
    surah_number: int,
    reciter_id: str,
    translation_lang: str | None,
) -> dict:
    meta = CUSTOM_AUDIO_RECITERS[reciter_id]
    source = meta.get("source", "everyayah")
    if source == "way2quran":
        return _fetch_surah_way2quran(client, surah_number, reciter_id, translation_lang)
    return _fetch_surah_everyayah(client, surah_number, reciter_id, translation_lang)


def _fetch_surah_way2quran(
    client: httpx.Client,
    surah_number: int,
    reciter_id: str,
    translation_lang: str | None,
) -> dict:
    meta = CUSTOM_AUDIO_RECITERS[reciter_id]
    slug = meta["way2quran_slug"]
    riwaya = meta["way2quran_riwaya"]
    available = _way2quran_available_surahs(slug, riwaya)
    surah_audio = (
        _way2quran_surah_url(slug, riwaya, surah_number) if surah_number in available else None
    )

    r = client.get(f"{ALQURAN}/surah/{surah_number}/quran-uthmani")
    r.raise_for_status()
    surah_data = r.json()["data"]
    tr_by_num, tr_edition, tr_info = _translation_payload(client, surah_number, translation_lang)

    ayahs = []
    for ayah in surah_data.get("ayahs", []):
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
                "audio": surah_audio,
                "audio_secondary": [],
                "translation_audio": tr_audio,
            }
        )

    return {
        "surah_number": surah_number,
        "reciter": reciter_id,
        "reciter_name": meta["name"],
        "playback_mode": meta.get("playback_mode", "surah"),
        "surah_audio_available": surah_audio is not None,
        "available_surah_count": len(available),
        "translation_lang": translation_lang,
        "translation_edition": tr_edition,
        "translation_audio_info": tr_info,
        "ayahs": ayahs,
    }


def _fetch_surah_everyayah(
    client: httpx.Client,
    surah_number: int,
    reciter_id: str,
    translation_lang: str | None,
) -> dict:
    meta = CUSTOM_AUDIO_RECITERS[reciter_id]
    path = meta["everyayah_path"]

    r = client.get(f"{ALQURAN}/surah/{surah_number}/quran-uthmani")
    r.raise_for_status()
    surah_data = r.json()["data"]

    tr_by_num, tr_edition, tr_info = _translation_payload(client, surah_number, translation_lang)

    ayahs = []
    for ayah in surah_data.get("ayahs", []):
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
                "audio": _everyayah_arabic_url(path, surah_number, num),
                "audio_secondary": [],
                "translation_audio": tr_audio,
            }
        )

    return {
        "surah_number": surah_number,
        "reciter": reciter_id,
        "reciter_name": meta["name"],
        "playback_mode": meta.get("playback_mode", "ayah"),
        "surah_audio_available": True,
        "translation_lang": translation_lang,
        "translation_edition": tr_edition,
        "translation_audio_info": tr_info,
        "ayahs": ayahs,
    }


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

    if reciter in CUSTOM_AUDIO_RECITERS:
        try:
            with httpx.Client(timeout=45) as client:
                return _fetch_surah_custom(client, surah_number, reciter, translation_lang)
        except httpx.HTTPStatusError as exc:
            raise HTTPException(502, f"Audio source error: {exc.response.status_code}") from exc
        except Exception as exc:
            raise HTTPException(502, "Could not fetch recitation audio") from exc

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
