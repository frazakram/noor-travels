import json
import math
import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Any

import psycopg2
from psycopg2.extras import RealDictCursor

from app.core.config import get_settings

SQLITE_PATH = Path(__file__).resolve().parents[1] / "data" / "noor_safar.db"
_use_sqlite: bool | None = None


def _postgres_available() -> bool:
    try:
        conn = psycopg2.connect(get_settings().database_url, connect_timeout=4)
        conn.close()
        return True
    except Exception:
        return False


def use_sqlite() -> bool:
    global _use_sqlite
    if _use_sqlite is None:
        flag = os.getenv("FORCE_SQLITE", "") or get_settings().force_sqlite
        if flag.lower() in ("1", "true", "yes"):
            _use_sqlite = True
        else:
            _use_sqlite = not _postgres_available()
            if _use_sqlite and get_settings().postgres_url:
                print(
                    "WARNING: POSTGRES_URL is set but Postgres is unreachable — "
                    "falling back to SQLite for the lifetime of this process."
                )
    return _use_sqlite


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
    else:
        conn = psycopg2.connect(get_settings().database_url)
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()


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
