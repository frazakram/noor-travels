"""Prayer times and reverse geocoding for Salah features."""

from __future__ import annotations

from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, HTTPException, Query

router = APIRouter()

# 1 = University of Islamic Sciences, Karachi (common in South Asia)
DEFAULT_METHOD = 1
DEFAULT_SCHOOL = 1  # Hanafi Asr


def _today_aladhan_date(tz: str | None = None) -> str:
    if tz:
        try:
            from zoneinfo import ZoneInfo

            return datetime.now(ZoneInfo(tz)).strftime("%d-%m-%Y")
        except Exception:
            pass
    return datetime.now(timezone.utc).strftime("%d-%m-%Y")


@router.get("/times")
async def prayer_times(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    method: int = Query(default=DEFAULT_METHOD, ge=1, le=23),
    school: int = Query(default=DEFAULT_SCHOOL, ge=0, le=1),
    date: str | None = Query(default=None, description="DD-MM-YYYY"),
    timezone: str | None = Query(default=None, description="IANA timezone for today's date"),
):
    day = date or _today_aladhan_date(timezone)
    url = f"https://api.aladhan.com/v1/timings/{day}"
    params = {
        "latitude": lat,
        "longitude": lng,
        "method": method,
        "school": school,
    }

    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.get(url, params=params)
        if resp.status_code != 200:
            raise HTTPException(502, "Could not fetch prayer times")
        payload = resp.json()

    try:
        data = payload["data"]
        timings = data["timings"]
        meta = data["meta"]
    except (KeyError, TypeError) as exc:
        raise HTTPException(502, "Unexpected prayer times response") from exc

    def clean(t: str) -> str:
        return t.split()[0] if t else ""

    fajr = clean(timings.get("Fajr", ""))
    sunrise = clean(timings.get("Sunrise", ""))
    dhuhr = clean(timings.get("Dhuhr", ""))
    asr = clean(timings.get("Asr", ""))
    maghrib = clean(timings.get("Maghrib", ""))
    isha = clean(timings.get("Isha", ""))
    midnight = clean(timings.get("Midnight", ""))

    prayers = [
        {"id": "fajr", "start": fajr, "end": sunrise},
        {"id": "dhuhr", "start": dhuhr, "end": asr},
        {"id": "asr", "start": asr, "end": maghrib},
        {"id": "maghrib", "start": maghrib, "end": isha},
        {"id": "isha", "start": isha, "end": midnight or fajr},
    ]

    greg = data.get("date", {}).get("gregorian", {})
    greg_date = greg.get("date", day) if isinstance(greg, dict) else day
    hijri = data.get("date", {}).get("hijri", {})

    return {
        "date": greg_date,
        "hijri": hijri if isinstance(hijri, dict) else {},
        "timezone": meta.get("timezone", "UTC"),
        "latitude": lat,
        "longitude": lng,
        "method": method,
        "school": school,
        "timings": {
            "fajr": fajr,
            "sunrise": sunrise,
            "dhuhr": dhuhr,
            "asr": asr,
            "maghrib": maghrib,
            "isha": isha,
            "midnight": midnight,
        },
        "prayers": prayers,
    }


@router.get("/location")
async def reverse_geocode(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
):
    url = "https://nominatim.openstreetmap.org/reverse"
    params = {
        "lat": lat,
        "lon": lng,
        "format": "json",
        "addressdetails": 1,
        "zoom": 14,
    }
    headers = {"User-Agent": "NoorSafar/1.0 (Islamic prayer app; contact@noorsafar.app)"}

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(url, params=params, headers=headers)
        if resp.status_code != 200:
            raise HTTPException(502, "Could not resolve location")
        data = resp.json()

    addr = data.get("address", {})
    locality = (
        addr.get("suburb")
        or addr.get("neighbourhood")
        or addr.get("city_district")
        or addr.get("town")
        or addr.get("village")
        or addr.get("city")
        or addr.get("county")
        or ""
    )
    region = addr.get("state") or addr.get("region") or ""
    country = addr.get("country") or ""

    parts = [p for p in [locality, region, country] if p]
    label = ", ".join(dict.fromkeys(parts)) if parts else data.get("display_name", "Your location")

    return {
        "label": label,
        "locality": locality,
        "region": region,
        "country": country,
        "display_name": data.get("display_name", label),
        "latitude": lat,
        "longitude": lng,
    }


@router.get("/geocode")
async def geocode_city(q: str = Query(min_length=2)):
    url = "https://nominatim.openstreetmap.org/search"
    params = {
        "q": q,
        "format": "json",
        "addressdetails": 1,
        "limit": 5,
    }
    headers = {"User-Agent": "NoorSafar/1.0 (Islamic prayer app; contact@noorsafar.app)"}

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(url, params=params, headers=headers)
        if resp.status_code != 200:
            raise HTTPException(502, "Could not search location")
        rows = resp.json()

    results = []
    for row in rows:
        addr = row.get("address", {})
        locality = (
            addr.get("suburb")
            or addr.get("city")
            or addr.get("town")
            or addr.get("village")
            or addr.get("county")
            or ""
        )
        region = addr.get("state") or addr.get("region") or ""
        country = addr.get("country") or ""
        parts = [p for p in [locality, region, country] if p]
        label = ", ".join(dict.fromkeys(parts)) or row.get("display_name", q)
        results.append(
            {
                "label": label,
                "display_name": row.get("display_name", label),
                "latitude": float(row["lat"]),
                "longitude": float(row["lon"]),
            }
        )

    return {"results": results}
