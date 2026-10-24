import json
import re
import sqlite3
import unittest
from pathlib import Path

from app.db import SQLITE_PATH

CONTENT = Path(__file__).resolve().parents[2] / "frontend" / "content" / "ibadah"
LANGS = ("en", "ur", "hi")
RULINGS = {"fard", "wajib", "sunnah", "mustahab"}


def _norm(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip().lower()


def _guides():
    return [(p.name, json.loads(p.read_text(encoding="utf-8"))) for p in sorted(CONTENT.glob("*.json"))]


def _steps(guide):
    for section in guide["sections"]:
        for step in section["items"]:
            yield section, step


class IbadahGuideShapeTest(unittest.TestCase):
    """Every guide is complete in all three languages and follows the content rules."""

    def test_guides_exist(self):
        self.assertTrue(_guides(), f"no guides in {CONTENT}")

    def test_shape(self):
        slugs = set()
        for name, g in _guides():
            self.assertEqual(name, f"{g['slug']}.json", name)
            self.assertNotIn(g["slug"], slugs, name)
            slugs.add(g["slug"])
            self.assertEqual(g["madhhab"], "hanafi", name)
            self.assertIn(g["group"], ("purification", "prayer", "ramadan", "hajj", "life"), name)
            self.assertIn(g["status"], ("draft", "reviewed"), name)
            if g["status"] == "reviewed":
                self.assertTrue(g.get("reviewedBy"), f"{name}: a reviewed guide names its reviewer")
            for field in ("title", "summary"):
                for lang in LANGS:
                    self.assertTrue(g[field].get(lang), f"{name}: {field}.{lang}")
            ids = set()
            for section, step in _steps(g):
                where = f"{name}:{section['id']}/{step['id']}"
                self.assertIn(section["kind"], ("steps", "list"), where)
                self.assertNotIn(step["id"], ids, f"{where}: duplicate step id")
                ids.add(step["id"])
                for field in ("text", "note", "meaning"):
                    if field in step:
                        for lang in LANGS:
                            self.assertTrue(step[field].get(lang), f"{where}: {field}.{lang}")
                if "ruling" in step:
                    self.assertIn(step["ruling"], RULINGS, where)
                self.assertTrue(step["refs"], f"{where}: every step cites its basis")
                # Fard must rest on the Quran or a hadith in this corpus. Hanafi wajibs often come
                # from collections the corpus doesn't hold (it is Sahih al-Bukhari only); those cite
                # the school's ruling as a fiqh reference, shown to users as awaiting scholar review.
                if step.get("ruling") == "fard":
                    self.assertTrue(
                        any(r["kind"] in ("quran", "hadith") for r in step["refs"]),
                        f"{where}: a fard step needs a Quran or hadith reference",
                    )
                if "arabic" in step:
                    self.assertTrue(step.get("transliteration") and step.get("meaning"), f"{where}: arabic needs transliteration and meaning")
                for ref in step["refs"]:
                    if ref["kind"] == "fiqh":
                        for lang in LANGS:
                            self.assertTrue(ref["text"].get(lang), f"{where}: fiqh.{lang}")


@unittest.skipUnless(SQLITE_PATH.exists(), "needs the local corpus (backend/data/noor_safar.db)")
class IbadahReferencesTest(unittest.TestCase):
    """A reference must say what it is cited for: its quote has to appear in that verse or hadith.
    Hadith numbers are this dataset's own (not the common numbering), so a number copied from
    elsewhere fails here instead of sending readers to an unrelated hadith."""

    @classmethod
    def setUpClass(cls):
        with sqlite3.connect(SQLITE_PATH) as conn:
            cls.hadith = {(c, n): e for c, n, e in conn.execute("SELECT collection, hadith_number, english FROM hadiths")}
            cls.ayah = {k: t for k, t in conn.execute("SELECT verse_key, translation_en FROM ayahs")}

    def test_every_quote_is_in_its_source(self):
        checked = 0
        for name, g in _guides():
            for section, step in _steps(g):
                where = f"{name}:{step['id']}"
                for ref in step["refs"]:
                    if ref["kind"] == "hadith":
                        text = self.hadith.get((ref["collection"], ref["number"]))
                        self.assertIsNotNone(text, f"{where}: no {ref['collection']} {ref['number']} in the corpus")
                        self.assertIn(_norm(ref["quote"]), _norm(text), f"{where}: quote not in {ref['collection']} {ref['number']}")
                        checked += 1
                    elif ref["kind"] == "quran":
                        text = self.ayah.get(ref["key"])
                        self.assertIsNotNone(text, f"{where}: no ayah {ref['key']}")
                        self.assertIn(_norm(ref["quote"]), _norm(text), f"{where}: quote not in {ref['key']}")
                        checked += 1
        self.assertGreater(checked, 0)


if __name__ == "__main__":
    unittest.main()
