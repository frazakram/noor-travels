import sqlite3
import tempfile
import unittest
import uuid
from pathlib import Path
from unittest import mock

from fastapi.testclient import TestClient

import app.db as db
from app.api import auth, rag
from app.main import app
from app.services import chat_history

MIGRATIONS = Path(__file__).resolve().parents[1] / "migrations"


def fake_chat(message, lang, history, **kwargs):
    return {
        "answer": f"Answer to {message} [Quran 2:153]",
        "citations": ["Quran 2:153"],
        "sources": [{"ref": "Quran 2:153", "type": "quran", "snippet": "x" * 2000, "score": 0.9}],
        "confidence": "high",
        "transliteration": "",
        "mode": "groq",
    }


class ChatHistoryTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        path = Path(self.tmp.name) / "h.db"
        with sqlite3.connect(path) as conn:
            conn.executescript((MIGRATIONS / "008_users_sqlite.sql").read_text())
            conn.executescript((MIGRATIONS / "013_chat_history_sqlite.sql").read_text())
            conn.execute("INSERT INTO users (id, email, password_hash) VALUES (1, 'a@x.io', 'h'), (2, 'b@x.io', 'h')")
        self.patches = [
            mock.patch.object(db, "SQLITE_PATH", path),
            mock.patch.object(db, "use_sqlite", return_value=True),
            mock.patch.object(chat_history, "use_sqlite", return_value=True),
            mock.patch.object(rag, "chat", side_effect=fake_chat),
        ]
        for p in self.patches:
            p.start()
        self.client = TestClient(app)
        self.alice = {"Authorization": f"Bearer {auth.issue_token(1)}"}
        self.bob = {"Authorization": f"Bearer {auth.issue_token(2)}"}

    def tearDown(self):
        for p in self.patches:
            p.stop()
        self.tmp.cleanup()

    def ask(self, cid, message, headers=None, **extra):
        body = {"message": message, "lang": "en", "conversation_id": cid, **extra}
        return self.client.post("/api/rag/chat", json=body, headers=headers or {})

    def test_signed_in_turns_are_saved_in_order_with_answer_details(self):
        cid = str(uuid.uuid4())
        self.assertTrue(self.ask(cid, "What is patience?", self.alice).json()["history_saved"])
        self.ask(cid, "And gratitude?", self.alice)
        chats = self.client.get("/api/chats", headers=self.alice).json()["conversations"]
        self.assertEqual([c["title"] for c in chats], ["What is patience?"])
        convo = self.client.get(f"/api/chats/{cid}", headers=self.alice).json()
        self.assertEqual([m["role"] for m in convo["messages"]], ["user", "assistant", "user", "assistant"])
        self.assertEqual(convo["messages"][2]["content"], "And gratitude?")
        meta = convo["messages"][1]["meta"]
        self.assertEqual(meta["citations"], ["Quran 2:153"])
        self.assertEqual(meta["response_lang"], "en")
        self.assertLessEqual(len(meta["sources"][0]["snippet"]), 800)

    def test_anonymous_and_bad_tokens_still_get_answers_but_nothing_is_saved(self):
        cid = str(uuid.uuid4())
        r = self.ask(cid, "What is patience?")
        self.assertEqual(r.status_code, 200)
        self.assertFalse(r.json()["history_saved"])
        r = self.ask(cid, "What is patience?", {"Authorization": "Bearer forged.token"})
        self.assertFalse(r.json()["history_saved"])
        self.assertNotIn("history_saved", self.client.post("/api/rag/chat", json={"message": "hello there"}).json())
        self.assertEqual(self.client.get("/api/chats", headers=self.alice).json()["conversations"], [])

    def test_other_users_cannot_read_write_star_or_delete(self):
        cid = str(uuid.uuid4())
        self.ask(cid, "Private question", self.alice)
        self.assertFalse(self.ask(cid, "Hijack", self.bob).json()["history_saved"])
        self.assertEqual(self.client.get(f"/api/chats/{cid}", headers=self.bob).status_code, 404)
        self.assertEqual(self.client.patch(f"/api/chats/{cid}", json={"starred": True}, headers=self.bob).status_code, 404)
        self.assertEqual(self.client.delete(f"/api/chats/{cid}", headers=self.bob).status_code, 404)
        self.assertEqual(self.client.get("/api/chats", headers=self.bob).json()["conversations"], [])
        convo = self.client.get(f"/api/chats/{cid}", headers=self.alice).json()
        self.assertEqual(len(convo["messages"]), 2)
        self.assertFalse(convo["starred"])
        self.assertEqual(self.client.get("/api/chats").status_code, 401)

    def test_star_rename_search_delete(self):
        a, b = str(uuid.uuid4()), str(uuid.uuid4())
        self.ask(a, "Dua for travel", self.alice)
        self.ask(a, "What about returning home?", self.alice)
        self.ask(b, "Fasting rules", self.alice)
        starred = self.client.patch(f"/api/chats/{a}", json={"starred": True}, headers=self.alice).json()
        self.assertTrue(starred["starred"])
        self.assertEqual(self.client.patch(f"/api/chats/{a}", json={"title": "  Travel   duas "}, headers=self.alice).json()["title"], "Travel duas")
        search = lambda q: [c["id"] for c in self.client.get("/api/chats", params={"q": q}, headers=self.alice).json()["conversations"]]  # noqa: E731
        self.assertEqual(search("returning"), [a])  # a later question, not the title
        self.assertEqual(search("FAST"), [b])
        self.assertEqual(search("100%"), [])
        self.assertEqual(self.client.delete(f"/api/chats/{a}", headers=self.alice).status_code, 204)
        self.assertEqual(search(""), [b])

    def test_regenerated_answer_replaces_the_last_turn(self):
        cid = str(uuid.uuid4())
        self.ask(cid, "What is patience?", self.alice)
        self.ask(cid, "What is patience?", self.alice, lang="ur", response_lang="ur", replace_last=True)
        messages = self.client.get(f"/api/chats/{cid}", headers=self.alice).json()["messages"]
        self.assertEqual(len(messages), 2)
        self.assertEqual(messages[1]["meta"]["response_lang"], "ur")

    def test_invalid_conversation_ids_are_rejected(self):
        self.assertEqual(self.ask("../etc", "What is patience?", self.alice).status_code, 422)
        self.assertEqual(self.client.get("/api/chats/not-a-uuid", headers=self.alice).status_code, 422)

    def test_long_titles_are_cut(self):
        self.assertEqual(len(chat_history.make_title("word " * 100)), 80)


if __name__ == "__main__":
    unittest.main()
