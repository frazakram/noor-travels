import unittest

from app.db import SQLITE_PATH

AYAT_AL_KURSI_EXCERPT = "اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ ۚ لَا تَأْخُذُهُ سِنَةٌ وَلَا نَوْمٌ"


@unittest.skipUnless(SQLITE_PATH.exists(), "needs the local Quran database (backend/data/noor_safar.db)")
class MatchArabicTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from app.services import quran_identify

        cls.qi = quran_identify

    def test_clean_partial_quote_of_a_long_ayah_ranks_it_first(self):
        results = self.qi.match_arabic(AYAT_AL_KURSI_EXCERPT)
        self.assertEqual(results[0]["verse_key"], "2:255")

    def test_ocr_noise_still_finds_the_verse(self):
        noisy = AYAT_AL_KURSI_EXCERPT.replace("الْقَيُّومُ", "القيوم |").replace("نَوْمٌ", "نوم 1") + " ﴿٢٥٥﴾ ~"
        results = self.qi.match_arabic(noisy)
        self.assertEqual(results[0]["verse_key"], "2:255")

    def test_unrelated_arabic_is_not_reported_as_a_confident_match(self):
        results = self.qi.match_arabic("مرحبا بكم في المطار الدولي الرحلة رقم خمسة")
        self.assertFalse(any(r["confidence"] == "high" for r in results), results[:2])


if __name__ == "__main__":
    unittest.main()
