import json
import unittest
from unittest import mock

from fastapi.testclient import TestClient

from app.api import rag
from app.db import DatabaseUnavailable
from app.main import app
from app.services.rag_service import _clean_transliteration


def _events(response) -> list[dict]:
    return [json.loads(line) for line in response.text.splitlines() if line.strip()]


class ChatStreamTest(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_stages_arrive_in_order_before_the_result(self):
        def fake_chat(message, lang, history, response_lang, include_transliteration, progress):
            progress("understanding", {})
            progress("searching", {"keywords": ["patience"]})
            progress("found", {"sources": ["Quran 2:153"]})
            progress("writing", {})
            return {"answer": "Be patient [Quran 2:153]", "citations": ["Quran 2:153"]}

        with mock.patch.object(rag, "chat", side_effect=fake_chat):
            response = self.client.post("/api/rag/chat/stream", json={"message": "patience?", "lang": "en"})
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.headers["content-type"].startswith("application/x-ndjson"))
        events = _events(response)
        self.assertEqual(
            [e.get("stage") or e["type"] for e in events], ["understanding", "searching", "found", "writing", "result"]
        )
        self.assertEqual(events[1]["keywords"], ["patience"])
        self.assertEqual(events[-1]["result"]["citations"], ["Quran 2:153"])

    def test_failure_becomes_an_error_event_not_a_hung_stream(self):
        with mock.patch.object(rag, "chat", side_effect=DatabaseUnavailable("down")):
            response = self.client.post("/api/rag/chat/stream", json={"message": "patience?", "lang": "en"})
        self.assertEqual(_events(response), [{"type": "error", "status": 503}])


class CleanTransliterationTest(unittest.TestCase):
    def test_source_references_are_removed(self):
        self.assertEqual(_clean_transliteration("Sahih al-Bukhari 33 Sahih al-Bukhari 2573 Tafsir 16:91"), "")
        self.assertEqual(_clean_transliteration("Tafsir 16:91 (ibn_kathir_en)\nRabbana atina"), "Rabbana atina")

    def test_real_transliteration_is_kept(self):
        text = "Bismillahi tawakkaltu ala Allah\nSubhanallah (Glory be to Allah)"
        self.assertEqual(_clean_transliteration(text), text)
        self.assertEqual(_clean_transliteration(None), "")


if __name__ == "__main__":
    unittest.main()
