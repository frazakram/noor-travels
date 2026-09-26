import sqlite3
import unittest

from app.db import SQLITE_PATH


@unittest.skipUnless(SQLITE_PATH.exists(), "needs the local Quran database (backend/data/noor_safar.db)")
class SurahDetectionTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from app.services.keyword_search import detect_surah_number

        cls.detect = staticmethod(detect_surah_number)

    def test_every_surah_name_resolves(self):
        rows = sqlite3.connect(SQLITE_PATH).execute("SELECT number, name_en FROM surahs").fetchall()
        wrong = [(n, name, self.detect(f"Explain Surah {name}")) for n, name in rows if self.detect(f"Explain Surah {name}") != n]
        self.assertEqual(wrong, [])

    def test_common_spellings_and_trailing_words(self):
        for question, expected in [
            ("Surah Rahman", 55), ("Surah Al-Fajr summary", 89), ("surah mulk tafsir in urdu", 67),
            ("Explain Yasin", 36), ("What is Surah Ikhlas about?", 112), ("explain al kahf", 18),
        ]:
            self.assertEqual(self.detect(question), expected, question)

    def test_prayer_and_prophet_names_are_not_surah_requests(self):
        for question in (
            "Can I combine Dhuhr and Asr while travelling?",
            "Is it allowed to pray Fajr late if I overslept?",
            "Tell me the story of Prophet Yunus",
            "What did Prophet Ibrahim say to his father?",
        ):
            self.assertIsNone(self.detect(question), question)


if __name__ == "__main__":
    unittest.main()
