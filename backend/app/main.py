import logging
import time

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.api import adhkar, auth, duas, hadith, khutba, quran, quran_audio, rag, recite, salah, tts
from app.core.config import get_settings
from app.core.limiter import limiter
from app.core.logging_setup import configure_logging
from app.db import DatabaseUnavailable, get_cursor

configure_logging()
logger = logging.getLogger("noor.api")

SLOW_REQUEST_MS = 3000

settings = get_settings()

_provider = settings.chat_provider.lower()
if _provider not in ("local", "groq", "openai"):
    logger.warning(f"unknown CHAT_PROVIDER '{settings.chat_provider}' — chat falls back to local templates.")
elif _provider == "groq" and not settings.groq_api_key.strip():
    logger.warning("CHAT_PROVIDER=groq but GROQ_API_KEY is empty — chat falls back to local templates.")
elif _provider == "openai" and not settings.openai_api_key.strip():
    logger.warning("CHAT_PROVIDER=openai but OPENAI_API_KEY is empty — chat falls back to local templates.")

app = FastAPI(title="Noor Safar API", version="1.0.0")

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)


@app.exception_handler(DatabaseUnavailable)
async def _database_unavailable(request: Request, exc: DatabaseUnavailable):
    logger.error("Database unavailable", extra={"event": "db_unavailable", "path": request.url.path})
    return JSONResponse(
        status_code=503,
        content={"detail": "Service is temporarily unavailable. Please try again in a moment."},
        headers={"Retry-After": "5"},
    )


@app.middleware("http")
async def _log_failures_and_slow_requests(request: Request, call_next):
    started = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        logger.exception("Unhandled error", extra={"event": "unhandled", "path": request.url.path})
        raise
    duration_ms = round((time.perf_counter() - started) * 1000)
    if response.status_code >= 500 or duration_ms >= SLOW_REQUEST_MS:
        logger.warning(
            "%s %s -> %d in %dms",
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
            extra={"event": "request", "path": request.url.path, "status": response.status_code, "duration_ms": duration_ms},
        )
    return response

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(quran.router, prefix="/api/quran", tags=["quran"])
app.include_router(quran_audio.router, prefix="/api/quran/audio", tags=["quran-audio"])
app.include_router(hadith.router, prefix="/api/hadith", tags=["hadith"])
app.include_router(duas.router, prefix="/api/duas", tags=["duas"])
app.include_router(adhkar.router, prefix="/api/adhkar", tags=["adhkar"])
app.include_router(rag.router, prefix="/api/rag", tags=["rag"])
app.include_router(tts.router, prefix="/api/tts", tags=["tts"])
app.include_router(khutba.router, prefix="/api/khutba", tags=["khutba"])
app.include_router(recite.router, prefix="/api/recite", tags=["recite"])
app.include_router(salah.router, prefix="/api/salah", tags=["salah"])
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])


@app.get("/api/health")
def health():
    settings = get_settings()
    if settings.use_groq_chat:
        chat_provider = "groq"
    elif settings.use_openai_chat:
        chat_provider = "openai"
    else:
        chat_provider = "local"
    return {
        "status": "ok",
        "app": "Noor Safar",
        "chat_provider": chat_provider,
        "embedding_provider": settings.embedding_provider,
    }


@app.get("/api/health/deep")
@limiter.limit("12/minute")
def health_deep(request: Request):
    """Exercises real dependencies so an uptime monitor can alert on a broken DB or dead LLM model."""
    from app.services.llm import complete, groq_client, groq_models

    checks: dict[str, dict] = {}
    started = time.perf_counter()
    try:
        with get_cursor() as cur:
            cur.execute("SELECT COUNT(*) AS n FROM ayahs")
            row = cur.fetchone()
        ayahs = int(row["n"])
        checks["database"] = {"ok": ayahs > 6000, "ayahs": ayahs}
    except Exception as exc:
        checks["database"] = {"ok": False, "error": type(exc).__name__}

    if get_settings().use_groq_chat:
        try:
            response = complete(
                groq_client(timeout=10.0),
                groq_models(),
                messages=[{"role": "user", "content": "Reply with the single word: ok"}],
                max_tokens=64,
            )
            checks["llm"] = {"ok": True, "model": response.model}
        except Exception as exc:
            checks["llm"] = {"ok": False, "error": type(exc).__name__, "detail": str(exc)[:200]}

    healthy = all(c["ok"] for c in checks.values())
    if not healthy:
        logger.error("Deep health check failed", extra={"event": "health_failed", "reason": str(checks)[:500]})
    return JSONResponse(
        status_code=200 if healthy else 503,
        content={
            "status": "ok" if healthy else "degraded",
            "checks": checks,
            "duration_ms": round((time.perf_counter() - started) * 1000),
        },
    )
