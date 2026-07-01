import hashlib
import json
import re
import time
from typing import Any

from app.core.config import get_settings
from app.db import get_conn, use_sqlite


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


def _ttl_seconds() -> int:
    return get_settings().rag_cache_ttl_hours * 3600


def get_cached(key: str) -> dict[str, Any] | None:
    ttl = _ttl_seconds()
    with get_conn() as conn:
        cur = conn.cursor()
        if use_sqlite():
            cur.execute("SELECT response_json, created_at FROM rag_cache WHERE cache_key = ?", (key,))
        else:
            cur.execute("SELECT response_json, created_at FROM rag_cache WHERE cache_key = %s", (key,))
        row = cur.fetchone()
        if not row:
            return None
        created = row[1] if not isinstance(row, dict) else row["created_at"]
        payload = row[0] if not isinstance(row, dict) else row["response_json"]
        if time.time() - float(created) > ttl:
            if use_sqlite():
                cur.execute("DELETE FROM rag_cache WHERE cache_key = ?", (key,))
            else:
                cur.execute("DELETE FROM rag_cache WHERE cache_key = %s", (key,))
            conn.commit()
            return None
        return json.loads(payload)


def set_cached(key: str, response: dict[str, Any]) -> None:
    now = time.time()
    payload = json.dumps(response, ensure_ascii=False)
    with get_conn() as conn:
        cur = conn.cursor()
        if use_sqlite():
            cur.execute(
                """
                INSERT OR REPLACE INTO rag_cache (cache_key, response_json, created_at)
                VALUES (?, ?, ?)
                """,
                (key, payload, now),
            )
        else:
            cur.execute(
                """
                INSERT INTO rag_cache (cache_key, response_json, created_at)
                VALUES (%s, %s, %s)
                ON CONFLICT (cache_key) DO UPDATE
                SET response_json = EXCLUDED.response_json, created_at = EXCLUDED.created_at
                """,
                (key, payload, now),
            )
        conn.commit()
