import contextlib
import json
import sqlite3
import tempfile
import unittest
import uuid
from pathlib import Path
from unittest import mock

from fastapi.testclient import TestClient

from app.api import rag
from app.main import app

SCHEMA = (Path(__file__).resolve().parents[1] / "migrations" / "012_chat_feedback_sqlite.sql").read_text()


class FeedbackTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.db = Path(self.tmp.name) / "fb.db"
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

        self.patches = [mock.patch.object(rag, "get_cursor", cursor), mock.patch.object(rag, "use_sqlite", return_value=True)]
        for p in self.patches:
            p.start()
        self.client = TestClient(app)

    def tearDown(self):
        for p in self.patches:
            p.stop()
        self.tmp.cleanup()

    def _vote(self, **overrides):
        body = {
            "id": str(uuid.uuid4()), "rating": -1, "question": "Is music allowed?",
            "answer": "I could not find a cited answer.", "citations": ["Quran 31:6"],
            "source_refs": ["Quran 31:6", "Sahih al-Bukhari 5590"], "lang": "en",
            "mode": "groq", "llm_model": "openai/gpt-oss-20b",
        }
        body.update(overrides)
        return body, self.client.post("/api/rag/feedback", json=body)

    def _rows(self):
        with sqlite3.connect(self.db) as conn:
            conn.row_factory = sqlite3.Row
            return [dict(r) for r in conn.execute("SELECT * FROM chat_feedback")]

    def test_vote_is_stored_with_its_answer(self):
        body, response = self._vote()
        self.assertEqual(response.status_code, 204)
        (row,) = self._rows()
        self.assertEqual((row["id"], row["rating"], row["question"]), (body["id"], -1, "Is music allowed?"))
        self.assertEqual(json.loads(row["source_refs"]), ["Quran 31:6", "Sahih al-Bukhari 5590"])
        self.assertEqual(row["llm_model"], "openai/gpt-oss-20b")

    def test_changing_a_vote_updates_the_same_row(self):
        body, _ = self._vote(rating=-1)
        _, response = self._vote(id=body["id"], rating=1, comment="  actually fine  ")
        self.assertEqual(response.status_code, 204)
        (row,) = self._rows()
        self.assertEqual((row["rating"], row["comment"]), (1, "actually fine"))

    def test_malformed_votes_are_rejected(self):
        for bad in ({"rating": 0}, {"rating": 2}, {"id": "not-a-uuid"}, {"question": ""}, {"answer": "x" * 12001},
                    {"citations": ["c"] * 21}):
            _, response = self._vote(**bad)
            self.assertEqual(response.status_code, 422, bad)
        self.assertEqual(self._rows(), [])


if __name__ == "__main__":
    unittest.main()
