#!/usr/bin/env python3
"""Generate ~1000 diverse RAG eval questions for Noor Safar chat."""
import json
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "data" / "eval_questions.json"

SURAHS = [
    ("Al-Fatiha", 1), ("Al-Baqarah", 2), ("Al-Imran", 3), ("Yasin", 36), ("Al-Ikhlas", 112),
    ("Al-Mulk", 67), ("Ar-Rahman", 55), ("Al-Kahf", 18), ("Maryam", 19), ("An-Naba", 78),
    ("At-Tawbah", 9), ("Hud", 11), ("Yusuf", 12), ("Ar-Ra'd", 13), ("Ibrahim", 14),
]

BEGINNER = [
    ("What are the five pillars of Islam?", ["quran", "hadith"], ["prayer", "fast", "hajj", "zakat", "shahada"], []),
    ("Who is Allah in Islam?", ["quran"], ["Allah", "worship", "One"], []),
    ("What is the Quran?", ["quran", "hadith"], ["Quran", "revelation", "Allah"], []),
    ("How do Muslims pray?", ["quran", "hadith"], ["prayer", "salah", "bow"], []),
    ("What is Ramadan?", ["quran", "hadith"], ["Ramadan", "fast", "month"], []),
    ("What is halal food?", ["quran", "hadith"], ["lawful", "eat", "forbidden"], []),
    ("Why do Muslims face the Kaaba?", ["quran", "hadith"], ["qibla", "direction", "prayer"], []),
    ("What happens on the Day of Judgment?", ["quran", "hadith"], ["judgment", "hereafter", "deeds"], []),
    ("How to become Muslim?", ["quran", "hadith"], ["shahada", "faith", "Allah"], []),
    ("What is dua?", ["quran", "hadith", "dua"], ["supplication", "call", "Allah"], []),
]

OTHER_FAITH = [
    ("Do Muslims believe in Jesus?", ["quran", "hadith"], ["Isa", "Jesus", "prophet", "Messiah"], []),
    ("What does Islam say about the Bible?", ["quran", "hadith"], ["Torah", "Gospel", "revealed"], []),
    ("Is Islam violent according to Quran?", ["quran", "hadith"], ["fight", "defend", "justice", "peace"], []),
    ("Can non-Muslims go to heaven in Islam?", ["quran", "hadith"], ["faith", "believer", "mercy"], []),
    ("What does Quran say about other religions?", ["quran"], ["People of the Book", "faith", "worship"], []),
    ("Why do Muslim women wear hijab?", ["quran", "hadith"], ["modesty", "cover", "guard"], []),
    ("Is Allah the same as the Christian God?", ["quran"], ["Allah", "One", "worship"], []),
    ("What is jihad in Islam?", ["quran", "hadith"], ["strive", "struggle", "fight"], []),
]

TRAVEL = [
    ("dua for starting travel", ["dua"], ["travel", "journey", "Dua"], []),
    ("prayer while travelling", ["hadith", "quran"], ["travel", "prayer", "shorten"], []),
    ("qibla direction while on a plane", ["quran", "hadith"], ["direction", "prayer", "qibla"], []),
    ("missed prayer during flight", ["hadith", "quran"], ["prayer", "make up", "travel"], []),
    ("safety dua for journey", ["dua", "quran"], ["travel", "safety", "protect"], []),
]

TAFSIR_TEMPLATES = [
    "explain the tafsir of Quran {vk}",
    "what is the meaning of ayah {vk}",
    "give commentary on {vk}",
    "why was {vk} revealed",
    "context of verse {vk}",
    "what do scholars say about {vk}",
]

HADITH_TOPICS = [
    "patience", "charity", "parents", "neighbors", "honesty", "backbiting", "prayer",
    "fasting", "hajj", "marriage", "kindness", "anger", "gratitude", "knowledge",
]

EXPERT = [
    ("difference between zakat and sadaqah", ["quran", "hadith"], ["zakat", "charity", "obligatory"], []),
    ("asr madhab hanafi vs shafi", ["hadith", "quran"], ["Asr", "shadow", "length"], []),
    ("conditions of tayammum", ["quran", "hadith"], ["tayammum", "dust", "purify"], []),
    ("ruling on combining prayers while travelling", ["hadith", "quran"], ["combine", "travel", "prayer"], []),
    ("what is nisab for zakat on gold", ["hadith", "quran"], ["gold", "nisab", "zakat"], []),
]


def build_cases() -> list[dict]:
    cases: list[dict] = []

    def add(q, types, needles, banned=None, category="general"):
        cases.append({
            "question": q,
            "expected_types": types,
            "must_contain": needles,
            "must_not_contain": banned or [],
            "category": category,
        })

    for row in BEGINNER:
        add(*row, category="beginner")
    for row in OTHER_FAITH:
        add(*row, category="other_faith")
    for row in TRAVEL:
        add(*row, category="travel")
    for row in EXPERT:
        add(*row, category="expert")

    # Hadith variations
    for topic in HADITH_TOPICS:
        add(f"hadith about {topic}", ["hadith", "quran"], [topic, "Bukhari"], [], "hadith")
        add(f"what did Prophet say about {topic}", ["hadith"], [topic, "Prophet"], [], "hadith")

    # Surah summaries
    for name, num in SURAHS:
        add(f"summarize surah {name}", ["quran"], [str(num), name.split()[-1]], [], "surah")
        add(f"what is surah {num} about", ["quran"], [str(num)], [], "surah")
        add(f"is surah {name} makki or madani", ["quran"], [str(num), "Makki", "Madani", "Medinan"], [], "surah")

    # Verse lookups
    for surah, num in SURAHS:
        for ayah in [1, 2, 3, 5, 10, 15, 20, 25]:
            vk = f"{num}:{ayah}"
            add(f"what is verse {vk}", ["quran"], [vk], ["Main teachings"], "verse")
            add(f"translate ayah {vk}", ["quran"], [vk], [], "verse")

    # Tafsir / explanation
    anchors = ["2:255", "2:286", "3:8", "18:10", "36:1", "55:1", "67:1", "112:1", "69:25", "4:34"]
    for vk in anchors:
        for tmpl in TAFSIR_TEMPLATES:
            add(tmpl.format(vk=vk), ["quran", "tafsir"], [vk.split(":")[0], "meaning", "Tafsir"], [], "tafsir")
        add(f"explain tafsir for {vk}", ["tafsir", "quran"], [vk, "Tafsir"], [], "tafsir")

    # Follow-up style (paired with context verse in eval runner)
    for vk in anchors:
        add("what is the tafsir for that verse", ["tafsir", "quran"], ["Tafsir", vk.split(":")[0]], [], "followup")
        add("tell me more about the meaning", ["quran", "tafsir"], ["meaning"], [], "followup")
        add("why was this ayah revealed", ["tafsir", "quran"], ["revealed", "context"], [], "followup")

    # Dua categories
    dua_topics = ["exam", "anxiety", "marriage", "health", "forgiveness", "rizq", "sleep", "rain", "new home"]
    for topic in dua_topics:
        add(f"dua for {topic}", ["dua", "quran", "hadith"], [topic], [], "dua")

    # Pad to ~1000 with permutations
    i = 0
    while len(cases) < 1000:
        name, num = SURAHS[i % len(SURAHS)]
        ayah = (i % 30) + 1
        vk = f"{num}:{ayah}"
        add(
            f"what does Quran {vk} teach about faith",
            ["quran"],
            [vk, str(num)],
            [],
            "generated",
        )
        i += 1

    return cases[:1000]


def main():
    cases = build_cases()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"version": 1, "total": len(cases), "cases": cases}, indent=2))
    print(f"Wrote {len(cases)} eval cases to {OUT}")


if __name__ == "__main__":
    main()
