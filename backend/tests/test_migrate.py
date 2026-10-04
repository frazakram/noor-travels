import contextlib
import io
import sqlite3
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from ingestion import migrate


class MigrateTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.path = Path(self.tmp.name) / "test.db"
        self.patches = [
            mock.patch.object(migrate, "SQLITE_PATH", self.path),
            mock.patch.object(migrate, "use_sqlite", return_value=True),
        ]
        for p in self.patches:
            p.start()

    def tearDown(self):
        for p in self.patches:
            p.stop()
        self.tmp.cleanup()

    def _run(self, *argv):
        out = io.StringIO()
        with mock.patch("sys.argv", ["migrate.py", *argv]), contextlib.redirect_stdout(out):
            code = migrate.main()
        return code, out.getvalue()

    def _versions(self):
        with sqlite3.connect(self.path) as conn:
            return dict(conn.execute("SELECT version, status FROM app_migrations").fetchall())

    def test_fresh_database_gets_every_migration_once(self):
        code, _ = self._run("--apply")
        self.assertEqual(code, 0)
        versions = self._versions()
        all_versions = set(migrate.discover(sqlite=True))
        self.assertEqual(set(versions), all_versions)
        self.assertEqual(versions["007"], "not_applicable")  # Postgres-only
        self.assertEqual(versions["002"], "applied")  # SQLite-only
        with sqlite3.connect(self.path) as conn:
            tables = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        self.assertTrue({"ayahs", "hadiths", "adhkar", "users"} <= tables)
        code, out = self._run("--apply")  # nothing runs twice
        self.assertEqual(code, 0)
        self.assertIn("0 pending", out)

    def test_untracked_database_is_refused_not_guessed(self):
        with sqlite3.connect(self.path) as conn:
            conn.execute("CREATE TABLE ayahs (id INTEGER)")
            conn.execute("INSERT INTO ayahs VALUES (1)")
        code, out = self._run("--apply")
        self.assertEqual(code, 1)
        self.assertIn("--baseline", out)
        with sqlite3.connect(self.path) as conn:
            self.assertEqual(conn.execute("SELECT COUNT(*) FROM ayahs").fetchone()[0], 1)  # 001 did not drop it

    def test_baseline_records_exactly_what_it_is_told(self):
        with sqlite3.connect(self.path) as conn:
            conn.execute("CREATE TABLE ayahs (id INTEGER)")
        code, out = self._run("--baseline", "011", "--except", "004")
        self.assertEqual(code, 0)
        versions = self._versions()
        self.assertNotIn("004", versions)
        self.assertEqual(versions["011"], "baseline")
        self.assertIn("pending 004", out)
        code, _ = self._run("--baseline", "011")  # a tracked database can't be re-baselined
        self.assertEqual(code, 1)

    def test_failed_migration_leaves_no_record(self):
        broken = Path(self.tmp.name) / "999_broken_sqlite.sql"
        broken.write_text("CREATE TABLE ok_table (id INTEGER); THIS IS NOT SQL;")
        real = migrate.discover(sqlite=True)
        with mock.patch.object(migrate, "discover", return_value={**real, "999": ("broken", broken)}):
            with self.assertRaises(sqlite3.Error):
                self._run("--apply")
        versions = self._versions()
        self.assertNotIn("999", versions)
        self.assertIn("011", versions)  # earlier migrations stayed applied


if __name__ == "__main__":
    unittest.main()
