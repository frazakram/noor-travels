import contextlib
import json
import sqlite3
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from fastapi.testclient import TestClient

from app.api import telemetry
from app.main import app

SCHEMA = (Path(__file__).resolve().parents[1] / "migrations" / "014_client_errors_sqlite.sql").read_text()


class ClientErrorsTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.db = Path(self.tmp.name) / "errors.db"
        with sqlite3.connect(self.db) as conn:
            conn.executescript(SCHEMA)

        @contextlib.contextmanager
        def cursor():
            conn = sqlite3.connect(self.db)
            try:
                yield conn.cursor()
                conn.commit()
            finally:
                conn.close()

        self.patches = [mock.patch.object(telemetry, "get_cursor", cursor), mock.patch.object(telemetry, "use_sqlite", return_value=True)]
        for p in self.patches:
            p.start()
        self.client = TestClient(app)

    def tearDown(self):
        for p in self.patches:
            p.stop()
        self.tmp.cleanup()

    def _send(self, *reports, content_type="text/plain"):
        return self.client.post("/api/telemetry/errors", content=json.dumps({"reports": list(reports)}), headers={"content-type": content_type})

    def _rows(self):
        with sqlite3.connect(self.db) as conn:
            conn.row_factory = sqlite3.Row
            return [dict(r) for r in conn.execute("SELECT * FROM client_errors")]

    def report(self, **overrides):
        r = {"kind": "error", "message": "Cannot read properties of undefined (reading 'verse_key')",
             "stack": "TypeError: x\n    at playFromIndex (https://site/_next/static/chunks/12.js:4:1234)",
             "path": "/quran/2?ayah=255", "platform": "web", "build": "abc123"}
        r.update(overrides)
        return r

    def test_accepts_a_text_plain_beacon(self):
        self.assertEqual(self._send(self.report()).status_code, 204)
        self.assertEqual(len(self._rows()), 1)

    def test_repeats_of_one_bug_are_one_row_with_a_count(self):
        # Same bug, different line/column numbers and query strings: still one problem.
        self._send(self.report(), self.report(stack="TypeError: x\n    at playFromIndex (https://site/_next/static/chunks/12.js:9:77)"))
        self._send(self.report(message="Cannot read properties of undefined (reading 'verse_key')", path="/quran/9"))
        rows = self._rows()
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["occurrences"], 3)

    def test_different_bugs_are_different_rows(self):
        self._send(self.report(), self.report(message="Network request failed"), self.report(kind="unhandledrejection"))
        self.assertEqual(len(self._rows()), 3)

    def test_never_stores_query_strings(self):
        self._send(self.report(path="/library?q=private+question#x"))
        self.assertEqual(self._rows()[0]["path"], "/library")

    def test_rejects_bad_input_without_storing(self):
        self.assertEqual(self.client.post("/api/telemetry/errors", content="not json", headers={"content-type": "text/plain"}).status_code, 400)
        self.assertEqual(self._send(self.report(kind="made-up")).status_code, 400)
        self.assertEqual(self._send(*[self.report()] * 11).status_code, 400)
        big = json.dumps({"reports": [self.report(stack="x" * 7000)] * 10})
        self.assertEqual(self.client.post("/api/telemetry/errors", content=big + " " * 70000).status_code, 413)
        self.assertEqual(self._rows(), [])

    def test_a_storage_failure_is_not_an_error_for_the_client(self):
        def broken():
            raise RuntimeError("db down")

        with mock.patch.object(telemetry, "get_cursor", broken):
            self.assertEqual(self._send(self.report()).status_code, 204)


if __name__ == "__main__":
    unittest.main()
