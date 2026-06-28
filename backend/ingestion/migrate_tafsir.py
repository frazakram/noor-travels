#!/usr/bin/env python3
import sys
from pathlib import Path

import psycopg2
import sqlite3

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import get_settings
from app.db import SQLITE_PATH, use_sqlite

SQLITE_SQL = Path(__file__).resolve().parents[1] / "migrations/003_tafsir_hindi_sqlite.sql"
PG_SQL = Path(__file__).resolve().parents[1] / "migrations/003_tafsir_hindi.sql"


def main():
    if use_sqlite():
        conn = sqlite3.connect(SQLITE_PATH)
        for stmt in SQLITE_SQL.read_text().split(";"):
            s = stmt.strip()
            if s:
                try:
                    conn.execute(s)
                except sqlite3.OperationalError as e:
                    if "duplicate column" not in str(e).lower():
                        raise
        conn.commit()
        conn.close()
        print("SQLite tafsir/hindi migration applied.")
    else:
        conn = psycopg2.connect(get_settings().database_url)
        conn.autocommit = True
        conn.cursor().execute(PG_SQL.read_text())
        conn.close()
        print("Postgres tafsir/hindi migration applied.")


if __name__ == "__main__":
    main()
