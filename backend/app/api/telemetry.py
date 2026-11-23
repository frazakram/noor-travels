"""Error reports from the app: the web page, the Android WebView and the native app.

Until this existed the only way to see a crash was a phone on a USB cable. Reports are grouped
by a fingerprint computed here (not trusted from the client), so a crash loop on many phones is
one row with a large `occurrences`, not thousands of rows. No user id, IP or query string is kept.

The client sends with navigator.sendBeacon as text/plain (no CORS preflight, never blocks the
page), so the body is parsed here rather than by FastAPI's JSON body handling.
"""
import hashlib
import json
import logging
import re

from fastapi import APIRouter, Request, Response
from pydantic import BaseModel, Field, ValidationError

from app.core.limiter import limiter
from app.db import get_cursor, use_sqlite

logger = logging.getLogger(__name__)
router = APIRouter()

MAX_BODY_BYTES = 64 * 1024
KINDS = ("error", "unhandledrejection", "react", "native_crash", "renderer_gone")
PLATFORMS = ("web", "apk", "native")


class ErrorReport(BaseModel):
    kind: str = Field(pattern="^(" + "|".join(KINDS) + ")$")
    message: str = Field(min_length=1, max_length=2000)
    stack: str | None = Field(default=None, max_length=8000)
    path: str | None = Field(default=None, max_length=300)
    platform: str = Field(default="web", pattern="^(" + "|".join(PLATFORMS) + ")$")
    app_version: str | None = Field(default=None, max_length=40)
    build: str | None = Field(default=None, max_length=40)


class ErrorBatch(BaseModel):
    reports: list[ErrorReport] = Field(min_length=1, max_length=10)


def _first_frame(stack: str | None) -> str:
    for line in (stack or "").splitlines()[1:]:
        line = line.strip()
        if line:
            return line
    return ""


def fingerprint(report: ErrorReport) -> str:
    """Same problem -> same row: numbers (ids, line/col, counts) and URLs' query strings vary
    between occurrences of one bug, so they are stripped before hashing."""
    message = re.sub(r"\d+", "#", report.message)
    frame = re.sub(r"\?[^\s):]*", "", re.sub(r":\d+(:\d+)?", "", _first_frame(report.stack)))
    raw = "\n".join((report.platform, report.kind, message, frame))
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()


def clean_path(path: str | None) -> str | None:
    """Keep only the route: no query string or fragment (they can carry search text)."""
    if not path:
        return None
    return re.split(r"[?#]", path, maxsplit=1)[0][:300] or None


_UPSERT_PG = """
    INSERT INTO client_errors (fingerprint, kind, message, stack, path, platform, app_version, build)
    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
    ON CONFLICT (fingerprint) DO UPDATE SET occurrences = client_errors.occurrences + 1, last_seen = NOW(),
      path = EXCLUDED.path, app_version = EXCLUDED.app_version, build = EXCLUDED.build
"""
_UPSERT_SQLITE = """
    INSERT INTO client_errors (fingerprint, kind, message, stack, path, platform, app_version, build)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (fingerprint) DO UPDATE SET occurrences = client_errors.occurrences + 1,
      last_seen = CURRENT_TIMESTAMP, path = excluded.path, app_version = excluded.app_version, build = excluded.build
"""


@router.post("/errors", status_code=204)
@limiter.limit("20/minute")
async def report_errors(request: Request):
    """Always answers 204 for a well-formed batch; malformed or oversized ones get 400/413.
    A storage failure is logged, not surfaced: reporting must never become a new error."""
    body = await request.body()
    if len(body) > MAX_BODY_BYTES:
        return Response(status_code=413)
    try:
        batch = ErrorBatch.model_validate(json.loads(body or b"{}"))
    except (ValueError, ValidationError):
        return Response(status_code=400)

    sql = _UPSERT_SQLITE if use_sqlite() else _UPSERT_PG
    try:
        with get_cursor() as cur:
            for r in batch.reports:
                cur.execute(sql, (fingerprint(r), r.kind, r.message, r.stack, clean_path(r.path), r.platform, r.app_version, r.build))
    except Exception:
        logger.exception("Storing client errors failed", extra={"event": "client_error_store_failed"})
    for r in batch.reports:
        logger.warning(
            "client error",
            extra={"event": "client_error", "path": clean_path(r.path),
                   "data": {"kind": r.kind, "platform": r.platform, "app_version": r.app_version, "message": r.message[:300]}},
        )
    return Response(status_code=204)
