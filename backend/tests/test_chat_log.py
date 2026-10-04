import unittest
from unittest import mock

from app.services import rag_service


class ChatAnswerLogTest(unittest.TestCase):
    def _logged(self, result, stages=()):
        def fake_answer(question, lang, history, response_lang, include_transliteration, progress):
            for stage in stages:
                progress(stage, {})
            return result

        with mock.patch.object(rag_service, "_answer", side_effect=fake_answer), mock.patch.object(
            rag_service.logger, "info"
        ) as info:
            rag_service.chat("My name is Ali, is music allowed?", "en", [{"role": "user", "content": "hi"}])
        self.assertEqual(info.call_args.kwargs["extra"]["event"], "chat_answer")
        return info.call_args.kwargs["extra"]["data"]

    def test_llm_answer_records_model_steps_and_sources(self):
        data = self._logged(
            {
                "answer": "Patience is praised [Quran 2:153].",
                "citations": ["Quran 2:153"],
                "sources": [{"type": "quran"}, {"type": "hadith"}],
                "mode": "groq",
                "llm_model": "qwen/qwen3.8-27b",
                "confidence": "high",
            },
            stages=("understanding", "searching", "found", "writing"),
        )
        self.assertEqual(data["llm_model"], "qwen/qwen3.8-27b")
        self.assertFalse(data["refused"])
        self.assertEqual((data["sources"], data["citations"], data["history_turns"]), (2, 1, 1))
        self.assertEqual(data["source_types"], ["hadith", "quran"])
        for step in ("analyze_ms", "rewrite_ms", "retrieve_ms", "prepare_ms", "answer_ms", "total_ms"):
            self.assertIn(step, data)

    def test_refusal_and_cache_hits_are_flagged(self):
        refusal = rag_service._localized_refusal("en")
        data = self._logged({"answer": refusal, "citations": [], "sources": [], "from_cache": True})
        self.assertTrue(data["refused"])
        self.assertTrue(data["cached"])
        self.assertNotIn("rewrite_ms", data)

    def test_question_text_is_never_logged(self):
        data = self._logged({"answer": "x", "citations": [], "sources": []})
        self.assertNotIn("Ali", repr(data))
        self.assertEqual(len(data["q_fingerprint"]), 12)


if __name__ == "__main__":
    unittest.main()
