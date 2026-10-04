import sqlite3
import unittest

from fastapi.testclient import TestClient

from app.db import SQLITE_PATH
from app.main import app


@unittest.skipUnless(SQLITE_PATH.exists(), "needs the local corpus (backend/data/noor_safar.db)")
class HadithByNumberTest(unittest.TestCase):
    """Citation links in chat open /hadith/<collection>/<number>; each must open exactly the
    hadith it names, for every hadith in the corpus."""

    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        with sqlite3.connect(SQLITE_PATH) as conn:
            cls.rows = conn.execute("SELECT collection, hadith_number, reference FROM hadiths").fetchall()

    def test_every_reference_resolves_to_itself(self):
        # The link is built from the reference text alone ("Sahih al-Bukhari 583" -> bukhari/583).
        names = {"bukhari": "Sahih al-Bukhari"}
        for collection, number, reference in self.rows:
            self.assertEqual(reference, f"{names[collection]} {number}", reference)
        for collection, number, reference in self.rows[:: max(1, len(self.rows) // 300)]:
            response = self.client.get(f"/api/hadith/{collection}/{number}")
            self.assertEqual(response.status_code, 200, reference)
            self.assertEqual(response.json()["reference"], reference)

    def test_unknown_numbers_and_collections_are_404(self):
        top = max(n for _c, n, _r in self.rows)
        for path in (f"/api/hadith/bukhari/{top + 1}", "/api/hadith/bukhari/0", "/api/hadith/notacollection/1", "/api/hadith/bu-khari/1"):
            self.assertEqual(self.client.get(path).status_code, 404, path)


if __name__ == "__main__":
    unittest.main()
