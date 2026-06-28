#!/usr/bin/env python3
"""Enable FTS5 hybrid search + RAG response cache on SQLite."""
import sys
from pathlib import Path

import sqlite3

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db import SQLITE_PATH, use_sqlite

SQL = Path(__file__).resolve().parents[1] / "migrations/002_fts_cache_sqlite.sql"


def main():
    if not use_sqlite():
        print("FTS cache migration is for SQLite local dev. Skipping.")
        return
    conn = sqlite3.connect(SQLITE_PATH)
    conn.executescript(SQL.read_text())
    conn.commit()
    count = conn.execute("SELECT COUNT(*) FROM chunks_fts").fetchone()[0]
    conn.close()
    print(f"FTS + cache ready — {count} chunks indexed.")


if __name__ == "__main__":
    main()
