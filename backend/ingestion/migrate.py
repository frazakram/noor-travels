#!/usr/bin/env python3
"""Apply schema to Postgres or SQLite."""
import sys
from pathlib import Path

import psycopg2
import sqlite3

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import get_settings
from app.db import SQLITE_PATH, use_sqlite

PG_SQL = Path(__file__).resolve().parents[1] / "migrations/001_schema.sql"
PG_SQL_EXTRA = Path(__file__).resolve().parents[1] / "migrations/003_tafsir_hindi.sql"
SQLITE_SQL = Path(__file__).resolve().parents[1] / "migrations/001_schema_sqlite.sql"


def migrate_postgres():
    sql = PG_SQL.read_text()
    settings = get_settings()
    conn = psycopg2.connect(settings.database_url)
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute(sql)
    cur.execute(PG_SQL_EXTRA.read_text())
    cur.close()
    conn.close()
    print("Postgres migration applied.")


def migrate_sqlite():
    SQLITE_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(SQLITE_PATH)
    conn.executescript(SQLITE_SQL.read_text())
    conn.commit()
    conn.close()
    print(f"SQLite migration applied at {SQLITE_PATH}")


def main():
    if use_sqlite():
        migrate_sqlite()
    else:
        migrate_postgres()


if __name__ == "__main__":
    main()
