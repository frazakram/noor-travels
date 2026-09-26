"""Prayer times and reverse geocoding for Salah features."""

from __future__ import annotations

from collections import OrderedDict
from datetime import datetime, timezone
from threading import Lock

import httpx
from fastapi import APIRouter, HTTPException, Query, Request, Response

from app.core.limiter import limiter

router = APIRouter()

# One pooled client per instance: AlAdhan is far from our region, and a fresh TLS
# handshake per request was most of this endpoint's latency.
_http = httpx.Client(timeout=15.0, limits=httpx.Limits(max_keepalive_connections=10))
_USER_AGENT = "NoorSafar/1.0 (+https://noor-travels-chi.vercel.app)"

# Results for an explicit date + coordinates never change, so browsers and the CDN may reuse them.
_CACHE_DATED = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400"
_CACHE_PLACE = "public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800"

_timings_cache: OrderedDict[tuple, dict] = OrderedDict()
_timings_lock = Lock()
_TIMINGS_CACHE_MAX = 512


def _fetch_aladhan(day: str, params: dict) -> dict:
    key = (day, *sorted(params.items()))
    with _timings_lock:
        if key in _timings_cache:
            _timings_cache.move_to_end(key)
            return _timings_cache[key]
    resp = _http.get(f"https://api.aladhan.com/v1/timings/{day}", params=params)
    if resp.status_code != 200:
        raise HTTPException(502, "Could not fetch prayer times")
    payload = resp.json()
    with _timings_lock:
        _timings_cache[key] = payload
        if len(_timings_cache) > _TIMINGS_CACHE_MAX:
            _timings_cache.popitem(last=False)
    return payload

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


def _shift_time(hhmm: str, minutes: int) -> str:
    """Shift an HH:MM string by whole minutes, wrapping within the day."""
    if not hhmm or not minutes:
        return hhmm
    try:
        h, m = (int(x) for x in hhmm.split(":"))
    except ValueError:
        return hhmm
    total = (h * 60 + m + minutes) % (24 * 60)
    return f"{total // 60:02d}:{total % 60:02d}"


@router.get("/times")
def prayer_times(
    response: Response,
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    method: int = Query(default=DEFAULT_METHOD, ge=1, le=23),
    school: int = Query(default=DEFAULT_SCHOOL, ge=0, le=1),
    date: str | None = Query(default=None, pattern=r"^\d{2}-\d{2}-\d{4}$", description="DD-MM-YYYY"),
    timezone: str | None = Query(default=None, description="IANA timezone for today's date"),
    fajr_adj: int = Query(default=0, ge=-60, le=60),
    dhuhr_adj: int = Query(default=0, ge=-60, le=60),
    asr_adj: int = Query(default=0, ge=-60, le=60),
    maghrib_adj: int = Query(default=0, ge=-60, le=60),
    isha_adj: int = Query(default=0, ge=-60, le=60),
    latitude_adjustment: int = Query(
        default=0,
        ge=0,
        le=3,
        description="Aladhan latitudeAdjustmentMethod: 0 none, 1 middle of night, 2 1/7th, 3 angle-based",
    ),
):
    day = date or _today_aladhan_date(timezone)
    params: dict = {
        "latitude": lat,
        "longitude": lng,
        "method": method,
        "school": school,
    }
    if latitude_adjustment > 0:
        params["latitudeAdjustmentMethod"] = latitude_adjustment

    try:
        payload = _fetch_aladhan(day, params)
    except httpx.HTTPError as exc:
        raise HTTPException(502, "Could not fetch prayer times") from exc

    try:
        data = payload["data"]
        timings = data["timings"]
        meta = data["meta"]
    except (KeyError, TypeError) as exc:
        raise HTTPException(502, "Unexpected prayer times response") from exc

    def clean(t: str) -> str:
        return t.split()[0] if t else ""

    # Per-prayer minute adjustments let users match their local masjid
    # timetable, which typically differs a few minutes from any calculation.
    fajr = _shift_time(clean(timings.get("Fajr", "")), fajr_adj)
    sunrise = clean(timings.get("Sunrise", ""))
    dhuhr = _shift_time(clean(timings.get("Dhuhr", "")), dhuhr_adj)
    asr = _shift_time(clean(timings.get("Asr", "")), asr_adj)
    maghrib = _shift_time(clean(timings.get("Maghrib", "")), maghrib_adj)
    isha = _shift_time(clean(timings.get("Isha", "")), isha_adj)
    midnight = clean(timings.get("Midnight", ""))

    # End times per fiqh consensus: Fajr ends at sunrise, each prayer ends
    # when the next begins, Isha ends at Islamic midnight (midpoint of
    # sunset to Fajr).
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

    # Without an explicit date the answer depends on "now", so only dated requests are cacheable.
    if date:
        response.headers["Cache-Control"] = _CACHE_DATED
    return {
        "date": greg_date,
        "hijri": hijri if isinstance(hijri, dict) else {},
        "timezone": meta.get("timezone", "UTC"),
        "latitude": lat,
        "longitude": lng,
        "method": method,
        "school": school,
        "latitude_adjustment": latitude_adjustment,
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
@limiter.limit("20/minute")
def reverse_geocode(
    request: Request,
    response: Response,
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
    try:
        resp = _http.get(url, params=params, headers={"User-Agent": _USER_AGENT})
    except httpx.HTTPError as exc:
        raise HTTPException(502, "Could not resolve location") from exc
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

    response.headers["Cache-Control"] = _CACHE_PLACE
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
@limiter.limit("20/minute")
def geocode_city(request: Request, q: str = Query(min_length=2, max_length=120)):
    url = "https://nominatim.openstreetmap.org/search"
    params = {
        "q": q,
        "format": "json",
        "addressdetails": 1,
        "limit": 5,
    }
    try:
        resp = _http.get(url, params=params, headers={"User-Agent": _USER_AGENT})
    except httpx.HTTPError as exc:
        raise HTTPException(502, "Could not search location") from exc
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
