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


@unittest.skipUnless(SQLITE_PATH.exists(), "needs the local hadith database")
class CuratedHadithReferencesTest(unittest.TestCase):
    """Curated theme hadith must actually be about the theme.

    The hadith data uses its own sequential numbering, not sunnah.com's, so a reference
    copied from a standard source silently points at an unrelated hadith.
    """

    def test_every_curated_hadith_mentions_its_theme(self):
        from app.services.query_expansion import THEMATIC_CLUSTERS

        db = sqlite3.connect(SQLITE_PATH)
        unrelated = []
        for cluster in THEMATIC_CLUSTERS:
            terms = [t.lower() for t in cluster.get("terms", [])]
            for ref in cluster.get("hadith_refs", []):
                row = db.execute("SELECT english, chapter_en FROM hadiths WHERE reference = ?", (ref,)).fetchone()
                text = " ".join(row).lower() if row else ""
                if not any(term in text for term in terms):
                    unrelated.append((cluster["id"], ref, text[:80]))
        self.assertEqual(unrelated, [])
