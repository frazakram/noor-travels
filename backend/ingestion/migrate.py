#!/usr/bin/env python3
"""Schema migrations for Postgres (production) or SQLite (local), tracked in app_migrations.

    .venv/bin/python ingestion/migrate.py            # status: what is applied, what is pending
    .venv/bin/python ingestion/migrate.py --apply    # apply pending migrations, in order

Migrations are migrations/NNN_name.sql (Postgres) and NNN_name_sqlite.sql (SQLite). A version
without a file for the current database (002 is SQLite-only, 006/007 Postgres-only) is
recorded as not applicable. Each migration runs in its own transaction with its record.

An existing database that predates this table must be baselined once, stating what it
already has; nothing is guessed (re-running 001 would drop every table):

    .venv/bin/python ingestion/migrate.py --baseline 011 --except 004
"""
import argparse
import re
import sqlite3
import sys
from pathlib import Path

import psycopg2

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import get_settings  # noqa: E402
from app.db import SQLITE_PATH, use_sqlite  # noqa: E402

MIGRATIONS_DIR = Path(__file__).resolve().parents[1] / "migrations"
_FILE = re.compile(r"^(\d{3})_(.+?)(_sqlite)?\.sql$")
TRACKING_SQL = (
    "CREATE TABLE IF NOT EXISTS app_migrations ("
    " version TEXT PRIMARY KEY, name TEXT NOT NULL, status TEXT NOT NULL,"
    " applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"
)


def discover(sqlite: bool) -> dict[str, tuple[str, Path | None]]:
    """version -> (name, file for this database or None when not applicable)."""
    found: dict[str, tuple[str, Path | None]] = {}
    for path in sorted(MIGRATIONS_DIR.glob("*.sql")):
        match = _FILE.match(path.name)
        if not match:
            continue
        version, name, is_sqlite = match.group(1), match.group(2), bool(match.group(3))
        current = found.get(version, (name, None))
        found[version] = (current[0], path if is_sqlite == sqlite else current[1])
    return dict(sorted(found.items()))


class Database:
    def __init__(self) -> None:
        self.sqlite = use_sqlite()
        if self.sqlite:
            self.conn = sqlite3.connect(SQLITE_PATH)
            self.mark = "?"
        else:
            self.conn = psycopg2.connect(get_settings().database_url)
            self.mark = "%s"

    def query(self, sql: str, params: tuple = ()) -> list[tuple]:
        cur = self.conn.cursor()
        cur.execute(sql, params)
        rows = cur.fetchall() if cur.description else []
        self.conn.commit()
        return rows

    def has_app_tables(self) -> bool:
        if self.sqlite:
            return bool(self.query("SELECT 1 FROM sqlite_master WHERE type='table' AND name='ayahs'"))
        return bool(self.query("SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='ayahs'"))

    def applied(self) -> dict[str, str]:
        self.query(TRACKING_SQL)
        return {v: s for v, s in self.query("SELECT version, status FROM app_migrations")}

    def record(self, cur, version: str, name: str, status: str) -> None:
        cur.execute(f"INSERT INTO app_migrations (version, name, status) VALUES ({self.mark}, {self.mark}, {self.mark})", (version, name, status))

    def run(self, version: str, name: str, path: Path | None) -> None:
        """The migration and its record commit together, or neither does."""
        cur = self.conn.cursor()
        try:
            if path is None:
                self.record(cur, version, name, "not_applicable")
            elif self.sqlite:
                # executescript commits on its own, so wrap the script and the record explicitly.
                record = f"INSERT INTO app_migrations (version, name, status) VALUES ('{version}', '{name}', 'applied');"
                self.conn.executescript(f"BEGIN;\n{path.read_text()}\n{record}\nCOMMIT;")
                return
            else:
                cur.execute(path.read_text())
                self.record(cur, version, name, "applied")
            self.conn.commit()
        except Exception:
            self.conn.rollback()
            raise


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--apply", action="store_true", help="apply pending migrations")
    parser.add_argument("--baseline", metavar="NNN", help="record versions <= NNN as already applied, without running them")
    parser.add_argument("--except", dest="excepted", default="", metavar="NNN,...", help="with --baseline: versions NOT present")
    args = parser.parse_args()

    db = Database()
    migrations = discover(db.sqlite)
    applied = db.applied()
    target = "SQLite " + str(SQLITE_PATH) if db.sqlite else "Postgres"

    if args.baseline:
        if applied:
            print(f"{target} is already tracked ({len(applied)} versions); baseline refused.")
            return 1
        excepted = {v.strip() for v in args.excepted.split(",") if v.strip()}
        cur = db.conn.cursor()
        for version, (name, _path) in migrations.items():
            if version <= args.baseline and version not in excepted:
                db.record(cur, version, name, "baseline")
        db.conn.commit()
        print(f"Baselined {target} at {args.baseline}" + (f" except {sorted(excepted)}" if excepted else ""))
        applied = db.applied()

    if not applied and db.has_app_tables():
        print(
            f"{target} has tables but no migration history. Check which migrations it really has,\n"
            "then record them once with --baseline NNN [--except NNN,...]. Nothing was run."
        )
        return 1

    pending = [(v, n, p) for v, (n, p) in migrations.items() if v not in applied]
    print(f"{target}: {len(applied)} recorded, {len(pending)} pending")
    for version, name, path in pending:
        print(f"  pending {version} {name}" + ("" if path else " (not applicable to this database)"))
    if not args.apply:
        return 0
    for version, name, path in pending:
        db.run(version, name, path)
        print(f"  {'applied' if path else 'recorded n/a'} {version} {name}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
