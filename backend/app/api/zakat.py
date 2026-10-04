"""Gold and silver rates in rupees per gram, for the zakat calculator.

Sources (free, no key): gold-api.com for the international spot price (USD per troy ounce),
open.er-api.com for USD->INR with frankfurter.dev as fallback. The Indian estimate adds the
customs duty on gold and silver: market rates in India are the international price plus
duty (GST is charged on purchase and is not part of quoted rates). Local jewellers differ
slightly, so the calculator lets the user overwrite the rate.
"""

import time
from threading import Lock

import httpx
from fastapi import APIRouter, HTTPException, Request, Response

from app.core.limiter import limiter

router = APIRouter()

TROY_OUNCE_GRAMS = 31.1034768
# Basic customs duty on gold and silver: 6% since the Union Budget of July 2024.
# Update here if the rate changes.
INDIA_IMPORT_DUTY = 0.06
_CACHE_S = 30 * 60

_http = httpx.Client(timeout=8.0, headers={"User-Agent": "NoorSafar/1.0 (+https://noor-travels-chi.vercel.app)"})
_lock = Lock()
_cached: tuple[float, dict] | None = None


def _spot_usd_per_ounce(symbol: str) -> tuple[float, str]:
    data = _http.get(f"https://api.gold-api.com/price/{symbol}").raise_for_status().json()
    price = float(data["price"])
    if not price > 0:
        raise ValueError(f"bad {symbol} price {price}")
    return price, str(data.get("updatedAt", ""))


def _usd_inr() -> tuple[float, str]:
    try:
        data = _http.get("https://open.er-api.com/v6/latest/USD").raise_for_status().json()
        return float(data["rates"]["INR"]), "open.er-api.com"
    except (httpx.HTTPError, KeyError, ValueError, TypeError):
        data = _http.get("https://api.frankfurter.dev/v1/latest", params={"base": "USD", "symbols": "INR"}).raise_for_status().json()
        return float(data["rates"]["INR"]), "frankfurter.dev"


def _fetch() -> dict:
    gold_oz, updated = _spot_usd_per_ounce("XAU")
    silver_oz, _ = _spot_usd_per_ounce("XAG")
    usd_inr, fx_source = _usd_inr()
    if not 50 < usd_inr < 200:  # sanity: a broken feed must not produce absurd zakat figures
        raise ValueError(f"implausible USD/INR {usd_inr}")
    gold = gold_oz / TROY_OUNCE_GRAMS * usd_inr
    silver = silver_oz / TROY_OUNCE_GRAMS * usd_inr
    return {
        "gold24kPerGram": round(gold * (1 + INDIA_IMPORT_DUTY), 2),
        "silverPerGram": round(silver * (1 + INDIA_IMPORT_DUTY), 2),
        "internationalGold24kPerGram": round(gold, 2),
        "internationalSilverPerGram": round(silver, 2),
        "usdInr": usd_inr,
        "importDuty": INDIA_IMPORT_DUTY,
        "updatedAt": updated,
        "sources": ["gold-api.com", fx_source],
    }


@router.get("/rates")
@limiter.limit("30/minute")
def rates(request: Request, response: Response):
    global _cached
    now = time.monotonic()
    with _lock:
        if _cached and now - _cached[0] < _CACHE_S:
            response.headers["Cache-Control"] = "public, max-age=600, s-maxage=1800"
            return _cached[1]
    try:
        data = _fetch()
    except (httpx.HTTPError, KeyError, ValueError, TypeError) as exc:
        raise HTTPException(503, "Live gold and silver rates are unavailable right now") from exc
    with _lock:
        _cached = (now, data)
    response.headers["Cache-Control"] = "public, max-age=600, s-maxage=1800"
    return data
