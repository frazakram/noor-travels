import json
import logging
import math
import os
import sqlite3
import threading
import time
from contextlib import contextmanager
from pathlib import Path
from typing import Any

import psycopg2
from psycopg2.extras import RealDictCursor
from psycopg2.pool import PoolError, ThreadedConnectionPool

from app.core.config import get_settings

logger = logging.getLogger(__name__)

SQLITE_PATH = Path(__file__).resolve().parents[1] / "data" / "noor_safar.db"

CONNECT_TIMEOUT_S = 4
CONNECT_ATTEMPTS = 2
# Serverless instances freeze between requests; a pooled connection idle longer
# than this is pinged before reuse because the server may have dropped it.
IDLE_PING_AFTER_S = 30
POOL_MAX = 10


class DatabaseUnavailable(RuntimeError):
    """Postgres could not be reached after retries — callers get a 503, never a silent fallback."""


def use_sqlite() -> bool:
    """SQLite only when forced or when no Postgres URL is configured.

    Never decided by a connectivity probe: a transient Postgres blip must not flip a
    production instance onto an empty local file for the rest of its life.
    """
    flag = os.getenv("FORCE_SQLITE", "") or get_settings().force_sqlite
    if flag.lower() in ("1", "true", "yes"):
        return True
    return not get_settings().postgres_url.strip()


_pool: ThreadedConnectionPool | None = None
_pool_lock = threading.Lock()
_last_used: dict[int, float] = {}
# Connections opened directly because the pool was full; closed after use, never pooled.
_overflow: set[int] = set()


def _get_pool() -> ThreadedConnectionPool:
    global _pool
    if _pool is None:
        with _pool_lock:
            if _pool is None:
                _pool = ThreadedConnectionPool(
                    0, POOL_MAX, get_settings().database_url, connect_timeout=CONNECT_TIMEOUT_S
                )
    return _pool


def _is_alive(conn) -> bool:
    if conn.closed:
        return False
    if time.monotonic() - _last_used.get(id(conn), 0) < IDLE_PING_AFTER_S:
        return True
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT 1")
        conn.rollback()
        return True
    except psycopg2.Error:
        return False


def _checkout_postgres():
    last_error: Exception | None = None
    for attempt in range(CONNECT_ATTEMPTS):
        try:
            pool = _get_pool()
            try:
                conn = pool.getconn()
            except PoolError:
                # Pool exhausted means busy, not down — serve this request on its own connection.
                conn = psycopg2.connect(get_settings().database_url, connect_timeout=CONNECT_TIMEOUT_S)
                _overflow.add(id(conn))
                return conn
            if _is_alive(conn):
                return conn
            pool.putconn(conn, close=True)
            _last_used.pop(id(conn), None)
        except psycopg2.Error as exc:
            last_error = exc
            logger.warning("postgres connect failed (attempt %d/%d): %s", attempt + 1, CONNECT_ATTEMPTS, exc)
            time.sleep(0.2 * (attempt + 1))
    raise DatabaseUnavailable("Database is temporarily unavailable") from last_error


def _row_to_dict(row: Any) -> dict:
    if isinstance(row, sqlite3.Row):
        return dict(row)
    return dict(row)


def _configure_sqlite(conn: sqlite3.Connection) -> None:
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA busy_timeout=30000")
    conn.execute("PRAGMA synchronous=NORMAL")


@contextmanager
def get_conn():
    if use_sqlite():
        SQLITE_PATH.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(SQLITE_PATH, timeout=30.0)
        conn.row_factory = sqlite3.Row
        _configure_sqlite(conn)
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()
        return

    conn = _checkout_postgres()
    broken = False
    try:
        yield conn
        conn.commit()
    except Exception as exc:
        broken = isinstance(exc, (psycopg2.OperationalError, psycopg2.InterfaceError)) or conn.closed != 0
        if not conn.closed:
            try:
                conn.rollback()
            except psycopg2.Error:
                broken = True
        raise
    finally:
        if id(conn) in _overflow:
            _overflow.discard(id(conn))
            conn.close()
        else:
            _last_used[id(conn)] = time.monotonic()
            _get_pool().putconn(conn, close=broken)
            if broken:
                _last_used.pop(id(conn), None)


@contextmanager
def get_cursor():
    with get_conn() as conn:
        if use_sqlite():
            cur = conn.cursor()
            yield _SQLiteCursor(cur)
        else:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                yield cur


class _SQLiteCursor:
    def __init__(self, cur: sqlite3.Cursor):
        self._cur = cur

    def execute(self, query: str, params=None):
        q = query.replace("%s", "?")
        q = q.replace("::vector", "")
        q = q.replace(" ILIKE ", " LIKE ")
        if "embedding <=>" in q:
            raise RuntimeError("Vector ops should use search_embeddings() for SQLite")
        self._cur.execute(q, params or ())
        return self

    def fetchall(self):
        return [_row_to_dict(r) for r in self._cur.fetchall()]

    def fetchone(self):
        row = self._cur.fetchone()
        return _row_to_dict(row) if row else None


def cosine_similarity(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(x * x for x in b))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)


def search_embeddings(query_embedding: list[float], min_sim: float, top_k: int) -> list[dict]:
    with get_conn() as conn:
        if use_sqlite():
            cur = conn.cursor()
            cur.execute(
                "SELECT source_type, source_ref, content, metadata, embedding FROM document_chunks"
            )
            rows = cur.fetchall()
            scored = []
            for source_type, source_ref, content, metadata, emb_json in rows:
                emb = json.loads(emb_json)
                sim = cosine_similarity(query_embedding, emb)
                if sim >= min_sim:
                    scored.append(
                        {
                            "source_type": source_type,
                            "source_ref": source_ref,
                            "content": content,
                            "metadata": json.loads(metadata) if metadata else {},
                            "similarity": sim,
                        }
                    )
            scored.sort(key=lambda x: x["similarity"], reverse=True)
            return scored[:top_k]
        else:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            embedding_str = "[" + ",".join(str(x) for x in query_embedding) + "]"
            cur.execute(
                """
                SELECT source_type, source_ref, content, metadata,
                       1 - (embedding <=> %s::vector) AS similarity
                FROM document_chunks
                WHERE 1 - (embedding <=> %s::vector) >= %s
                ORDER BY embedding <=> %s::vector
                LIMIT %s
                """,
                (embedding_str, embedding_str, min_sim, embedding_str, top_k),
            )
            return [dict(r) for r in cur.fetchall()]
