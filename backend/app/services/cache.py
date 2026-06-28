import hashlib
import json
import re
import time
from typing import Any

from app.db import get_conn, use_sqlite

_TTL_SECONDS = 168 * 3600  # 7 days


def _normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text.strip().lower())


def make_cache_key(
    question: str,
    lang: str,
    history_tail: str = "",
    include_transliteration: bool = False,
) -> str:
    raw = f"{lang}|{int(include_transliteration)}|{_normalize(question)}|{_normalize(history_tail)}"
    return hashlib.sha256(raw.encode()).hexdigest()


def get_cached(key: str) -> dict[str, Any] | None:
    if not use_sqlite():
        return None
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute("SELECT response_json, created_at FROM rag_cache WHERE cache_key = ?", (key,))
        row = cur.fetchone()
        if not row:
            return None
        if time.time() - row[1] > _TTL_SECONDS:
            cur.execute("DELETE FROM rag_cache WHERE cache_key = ?", (key,))
            return None
        return json.loads(row[0])


def set_cached(key: str, response: dict[str, Any]) -> None:
    if not use_sqlite():
        return
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            INSERT OR REPLACE INTO rag_cache (cache_key, response_json, created_at)
            VALUES (?, ?, ?)
            """,
            (key, json.dumps(response, ensure_ascii=False), time.time()),
        )
