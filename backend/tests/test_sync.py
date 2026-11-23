import contextlib
import sqlite3
import tempfile
import time
import unittest
from pathlib import Path
from unittest import mock

from fastapi.testclient import TestClient

from app.api import auth, sync
from app.main import app

MIGRATIONS = Path(__file__).resolve().parents[1] / "migrations"
DAY = 86_400_000


class MergeTest(unittest.TestCase):
    def test_newer_item_wins_per_item(self):
        a = {"items": {"x": {"v": 1, "t": 10}, "y": {"v": "a", "t": 50}}}
        b = {"items": {"x": {"v": 2, "t": 20}, "y": {"v": "b", "t": 40}, "z": {"v": 0, "t": 1}}}
        self.assertEqual(sync.merge(a, b, now_ms=100)["items"], {"x": {"v": 2, "t": 20}, "y": {"v": "a", "t": 50}, "z": {"v": 0, "t": 1}})

    def test_a_deletion_spreads_and_wins_a_tie(self):
        kept = {"items": {"x": {"v": 1, "t": 10}}}
        deleted = {"items": {"x": {"t": 10, "d": 1}}}
        self.assertEqual(sync.merge(kept, deleted, now_ms=100)["items"]["x"], {"t": 10, "d": 1})
        self.assertEqual(sync.merge(deleted, kept, now_ms=100)["items"]["x"], {"t": 10, "d": 1})
        # ...but a newer re-add beats an older deletion
        self.assertEqual(sync.merge(deleted, {"items": {"x": {"v": 3, "t": 11}}}, now_ms=100)["items"]["x"]["v"], 3)

    def test_old_tombstones_are_dropped(self):
        now = 400 * DAY
        doc = {"items": {"old": {"t": now - 181 * DAY, "d": 1}, "recent": {"t": now - 10 * DAY, "d": 1}, "live": {"v": 1, "t": 0}}}
        self.assertEqual(set(sync.merge(doc, now_ms=now)["items"]), {"recent", "live"})

    def test_size_is_bounded_by_dropping_the_oldest(self):
        doc = {"items": {str(i): {"v": 1, "t": i} for i in range(sync.MAX_ITEMS + 5)}}
        items = sync.merge(doc, now_ms=10**6)["items"]
        self.assertEqual(len(items), sync.MAX_ITEMS)
        self.assertNotIn("0", items)
        self.assertIn(str(sync.MAX_ITEMS + 4), items)

    def test_parse_revs_ignores_junk(self):
        self.assertEqual(sync.parse_revs("hifz:3,quran-bookmarks:12,nope:1,hifz-x,salah-streak:-1"), {"hifz": 3, "quran-bookmarks": 12})


class SyncApiTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.db = Path(self.tmp.name) / "sync.db"
        with sqlite3.connect(self.db) as conn:
            conn.executescript("CREATE TABLE users (id INTEGER PRIMARY KEY);")
            conn.executescript((MIGRATIONS / "015_user_sync_sqlite.sql").read_text())
            conn.executemany("INSERT INTO users (id) VALUES (?)", [(1,), (2,)])

        @contextlib.contextmanager
        def cursor():
            conn = sqlite3.connect(self.db)
            conn.row_factory = lambda c, r: {d[0]: r[i] for i, d in enumerate(c.description)}
            try:
                yield _Cur(conn.cursor())
                conn.commit()
            finally:
                conn.close()

        self.patches = [mock.patch.object(sync, "get_cursor", cursor), mock.patch.object(sync, "use_sqlite", return_value=True)]
        for p in self.patches:
            p.start()
        self.client = TestClient(app)

    def tearDown(self):
        for p in self.patches:
            p.stop()
        self.tmp.cleanup()

    def h(self, user=1):
        return {"Authorization": f"Bearer {auth.issue_token(user)}"}

    def put(self, ns, items, user=1):
        return self.client.put(f"/api/sync/{ns}", json={"items": items}, headers=self.h(user))

    def pull(self, revs=None, user=1):
        r = self.client.get("/api/sync", params={"revs": revs} if revs else None, headers=self.h(user))
        self.assertEqual(r.status_code, 200, r.text)
        return r.json()["namespaces"]

    def test_two_devices_merge_instead_of_overwriting(self):
        t = int(time.time() * 1000)
        self.assertEqual(self.put("quran-bookmarks", {"2:255": {"v": {"n": 1}, "t": t}}).json(), {"base": 0, "rev": 1})
        self.assertEqual(self.put("quran-bookmarks", {"36:1": {"v": {"n": 2}, "t": t + 1}}).json(), {"base": 1, "rev": 2})
        self.put("quran-bookmarks", {"2:255": {"t": t + 2, "d": 1}})
        ns = self.pull()["quran-bookmarks"]
        self.assertEqual(ns["rev"], 3)
        self.assertEqual(ns["items"], {"2:255": {"t": t + 2, "d": 1}, "36:1": {"v": {"n": 2}, "t": t + 1}})

    def test_pull_skips_namespaces_the_device_already_has(self):
        self.put("hifz", {"a": {"v": 1, "t": 1}})
        self.put("salah-streak", {"2026-11-24|fajr": {"v": True, "t": 1}})
        self.assertEqual(set(self.pull()), {"hifz", "salah-streak"})
        self.assertEqual(set(self.pull("hifz:1")), {"salah-streak"})
        self.assertEqual(self.pull("hifz:1,salah-streak:1"), {})

    def test_users_are_isolated_and_auth_is_required(self):
        self.put("hifz", {"a": {"v": 1, "t": 1}}, user=1)
        self.assertEqual(self.pull(user=2), {})
        self.assertEqual(self.client.get("/api/sync").status_code, 401)
        self.assertEqual(self.client.put("/api/sync/hifz", json={"items": {}}).status_code, 401)

    def test_rejects_bad_input(self):
        self.assertEqual(self.put("not-a-namespace", {}).status_code, 404)
        self.assertEqual(self.put("hifz", {"a": {"v": 1}}).status_code, 422)  # no timestamp
        self.assertEqual(self.put("hifz", {"a": {"t": 1, "d": 2}}).status_code, 422)
        self.assertEqual(self.put("hifz", {"x" * 200: {"v": 1, "t": 1}}).status_code, 413)
        self.assertEqual(self.pull(), {})


class _Cur:
    """get_cursor's SQLite adapter, reduced to what the router uses."""

    def __init__(self, cur):
        self._cur = cur

    def execute(self, q, params=()):
        self._cur.execute(q.replace("%s", "?"), params)

    def fetchone(self):
        return self._cur.fetchone()

    def fetchall(self):
        return self._cur.fetchall()


if __name__ == "__main__":
    unittest.main()
