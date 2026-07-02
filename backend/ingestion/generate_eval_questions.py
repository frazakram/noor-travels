#!/usr/bin/env python3
"""Generate diverse question bank for eval + pre-loaded question library."""
from __future__ import annotations

import json
import re
from pathlib import Path

TARGET_TOTAL = 3000
OUT = Path(__file__).resolve().parents[1] / "data" / "eval_questions.json"

# English surah names (1–114)
SURAH_NAMES: dict[int, str] = {
    1: "Al-Fatiha", 2: "Al-Baqarah", 3: "Al-Imran", 4: "An-Nisa", 5: "Al-Maidah",
    6: "Al-Anam", 7: "Al-Araf", 8: "Al-Anfal", 9: "At-Tawbah", 10: "Yunus",
    11: "Hud", 12: "Yusuf", 13: "Ar-Rad", 14: "Ibrahim", 15: "Al-Hijr",
    16: "An-Nahl", 17: "Al-Isra", 18: "Al-Kahf", 19: "Maryam", 20: "Ta-Ha",
    21: "Al-Anbiya", 22: "Al-Hajj", 23: "Al-Muminun", 24: "An-Nur", 25: "Al-Furqan",
    26: "Ash-Shuara", 27: "An-Naml", 28: "Al-Qasas", 29: "Al-Ankabut", 30: "Ar-Rum",
    31: "Luqman", 32: "As-Sajdah", 33: "Al-Ahzab", 34: "Saba", 35: "Fatir",
    36: "Yasin", 37: "As-Saffat", 38: "Sad", 39: "Az-Zumar", 40: "Ghafir",
    41: "Fussilat", 42: "Ash-Shura", 43: "Az-Zukhruf", 44: "Ad-Dukhan", 45: "Al-Jathiyah",
    46: "Al-Ahqaf", 47: "Muhammad", 48: "Al-Fath", 49: "Al-Hujurat", 50: "Qaf",
    51: "Adh-Dhariyat", 52: "At-Tur", 53: "An-Najm", 54: "Al-Qamar", 55: "Ar-Rahman",
    56: "Al-Waqiah", 57: "Al-Hadid", 58: "Al-Mujadila", 59: "Al-Hashr", 60: "Al-Mumtahanah",
    61: "As-Saff", 62: "Al-Jumuah", 63: "Al-Munafiqun", 64: "At-Taghabun", 65: "At-Talaq",
    66: "At-Tahrim", 67: "Al-Mulk", 68: "Al-Qalam", 69: "Al-Haqqah", 70: "Al-Maarij",
    71: "Nuh", 72: "Al-Jinn", 73: "Al-Muzzammil", 74: "Al-Muddaththir", 75: "Al-Qiyamah",
    76: "Al-Insan", 77: "Al-Mursalat", 78: "An-Naba", 79: "An-Naziat", 80: "Abasa",
    81: "At-Takwir", 82: "Al-Infitar", 83: "Al-Mutaffifin", 84: "Al-Inshiqaq", 85: "Al-Buruj",
    86: "At-Tariq", 87: "Al-Ala", 88: "Al-Ghashiyah", 89: "Al-Fajr", 90: "Al-Balad",
    91: "Ash-Shams", 92: "Al-Layl", 93: "Ad-Duha", 94: "Ash-Sharh", 95: "At-Tin",
    96: "Al-Alaq", 97: "Al-Qadr", 98: "Al-Bayyinah", 99: "Az-Zalzalah", 100: "Al-Adiyat",
    101: "Al-Qariah", 102: "At-Takathur", 103: "Al-Asr", 104: "Al-Humazah", 105: "Al-Fil",
    106: "Quraysh", 107: "Al-Maun", 108: "Al-Kawthar", 109: "Al-Kafirun", 110: "An-Nasr",
    111: "Al-Masad", 112: "Al-Ikhlas", 113: "Al-Falaq", 114: "An-Nas",
}

AYAH_COUNTS: dict[int, int] = {
    1: 7, 2: 286, 3: 200, 4: 176, 5: 120, 6: 165, 7: 206, 8: 75, 9: 129, 10: 109,
    11: 123, 12: 111, 13: 43, 14: 52, 15: 99, 16: 128, 17: 111, 18: 110, 19: 98, 20: 135,
    21: 112, 22: 78, 23: 118, 24: 64, 25: 77, 26: 227, 27: 93, 28: 88, 29: 69, 30: 60,
    31: 34, 32: 30, 33: 73, 34: 54, 35: 45, 36: 83, 37: 182, 38: 88, 39: 75, 40: 85,
    41: 54, 42: 53, 43: 89, 44: 59, 45: 37, 46: 35, 47: 38, 48: 29, 49: 18, 50: 45,
    51: 60, 52: 49, 53: 62, 54: 55, 55: 78, 56: 96, 57: 29, 58: 22, 59: 24, 60: 13,
    61: 14, 62: 11, 63: 11, 64: 18, 65: 12, 66: 12, 67: 30, 68: 52, 69: 52, 70: 44,
    71: 28, 72: 28, 73: 20, 74: 56, 75: 40, 76: 31, 77: 50, 78: 40, 79: 46, 80: 42,
    81: 29, 82: 19, 83: 36, 84: 25, 85: 22, 86: 17, 87: 19, 88: 26, 89: 30, 90: 20,
    91: 15, 92: 21, 93: 11, 94: 8, 95: 8, 96: 19, 97: 5, 98: 8, 99: 8, 100: 11,
    101: 11, 102: 8, 103: 3, 104: 9, 105: 5, 106: 4, 107: 7, 108: 3, 109: 6, 110: 3,
    111: 5, 112: 4, 113: 5, 114: 6,
}

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
    ("What is wudu ablution?", ["hadith", "quran"], ["wudu", "ablution", "purify"], []),
    ("What breaks wudu?", ["hadith", "quran"], ["wudu", "ablution"], []),
    ("What is shahada?", ["quran", "hadith"], ["shahada", "faith", "Allah"], []),
    ("Why do Muslims fast?", ["quran", "hadith"], ["fast", "Ramadan", "taqwa"], []),
    ("What is zakat?", ["quran", "hadith"], ["zakat", "charity", "poor"], []),
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
    ("Do Muslims believe in angels?", ["quran", "hadith"], ["angel", "Jibril", "believe"], []),
    ("What does Islam say about science?", ["quran", "hadith"], ["sign", "reflect", "knowledge"], []),
    ("Why can't Muslims eat pork?", ["quran", "hadith"], ["forbidden", "pork", "lawful"], []),
    ("What does Islam teach about alcohol?", ["quran", "hadith"], ["wine", "intoxicant", "avoid"], []),
]

TRAVEL = [
    ("dua for starting travel", ["dua"], ["travel", "journey", "Dua"], []),
    ("prayer while travelling", ["hadith", "quran"], ["travel", "prayer", "shorten"], []),
    ("qibla direction while on a plane", ["quran", "hadith"], ["direction", "prayer", "qibla"], []),
    ("missed prayer during flight", ["hadith", "quran"], ["prayer", "make up", "travel"], []),
    ("safety dua for journey", ["dua", "quran"], ["travel", "safety", "protect"], []),
    ("dua when entering a vehicle", ["dua", "hadith"], ["travel", "vehicle", "trust"], []),
    ("dua when returning home from travel", ["dua", "hadith"], ["travel", "return", "home"], []),
]

REVERT = [
    ("I am new to Islam what should I learn first?", ["quran", "hadith"], ["faith", "prayer", "Quran"], []),
    ("How do I start praying as a new Muslim?", ["hadith", "quran"], ["prayer", "salah", "learn"], []),
    ("Basic beliefs every Muslim should know", ["quran", "hadith"], ["Allah", "prophet", "faith"], []),
    ("How to read Quran as a beginner?", ["quran", "hadith"], ["Quran", "read", "learn"], []),
    ("What is the meaning of Allahu Akbar?", ["quran", "hadith"], ["Allah", "great"], []),
]

KIDS = [
    ("Why do we pray five times a day?", ["quran", "hadith"], ["prayer", "five", "salah"], []),
    ("Who is Prophet Muhammad for children?", ["hadith", "quran"], ["Prophet", "Muhammad", "mercy"], []),
    ("What is heaven in Islam for kids?", ["quran", "hadith"], ["Paradise", "Jannah", "reward"], []),
    ("Why should children be kind to parents?", ["quran", "hadith"], ["parent", "kindness"], []),
    ("Is lying allowed in Islam?", ["quran", "hadith"], ["truth", "honest", "lie"], []),
]

DAILY_LIFE = [
    ("Islamic etiquette for eating", ["hadith", "quran"], ["eat", "Bismillah", "right hand"], []),
    ("how to greet in Islam", ["hadith", "quran"], ["salam", "greet", "peace"], []),
    ("rights of neighbors in Islam", ["quran", "hadith"], ["neighbor", "kindness", "rights"], []),
    ("honesty in business Islam", ["hadith", "quran"], ["honest", "trade", "business"], []),
    ("anger management in Islam", ["hadith", "quran"], ["anger", "patient", "control"], []),
    ("gratitude in Quran and Hadith", ["quran", "hadith"], ["grateful", "thanks", "blessing"], []),
    ("sleeping dua before bed", ["dua", "hadith"], ["sleep", "bed", "protect"], []),
    ("morning remembrance dhikr", ["hadith", "quran"], ["morning", "remembrance", "dhikr"], []),
]

SALAH = [
    ("how many rakah in fajr prayer", ["hadith", "quran"], ["Fajr", "rakah", "prayer"], []),
    ("what to recite in sujood", ["hadith", "quran"], ["sujood", "prostration", "dua"], []),
    ("can I combine prayers when travelling", ["hadith", "quran"], ["combine", "travel", "prayer"], []),
    ("what invalidates prayer salah", ["hadith", "quran"], ["prayer", "break", "nullify"], []),
    ("importance of congregation prayer", ["hadith", "quran"], ["congregation", "jamaah", "mosque"], []),
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
    "mercy", "forgiveness", "jealousy", "greed", "humility", "trust", "sincerity",
    "intention", "repentance", "death", "grave", "angels", "dreams", "medicine",
    "clothing", "hygiene", "smiling", "friendship", "leadership", "justice",
]

EXPERT = [
    ("difference between zakat and sadaqah", ["quran", "hadith"], ["zakat", "charity", "obligatory"], []),
    ("asr madhab hanafi vs shafi", ["hadith", "quran"], ["Asr", "shadow", "length"], []),
    ("conditions of tayammum", ["quran", "hadith"], ["tayammum", "dust", "purify"], []),
    ("ruling on combining prayers while travelling", ["hadith", "quran"], ["combine", "travel", "prayer"], []),
    ("what is nisab for zakat on gold", ["hadith", "quran"], ["gold", "nisab", "zakat"], []),
    ("difference between makruh and haram", ["hadith", "quran"], ["forbidden", "disliked"], []),
    ("conditions of valid wudu", ["hadith", "quran"], ["wudu", "ablution"], []),
]

DUA_TOPICS = [
    "exam", "anxiety", "marriage", "health", "forgiveness", "rizq", "sleep", "rain",
    "new home", "travel", "protection", "guidance", "success", "sick", "debt",
    "job", "pregnancy", "newborn", "stress", "fear", "morning", "evening",
]

FAITH_TOPICS = [
    "tawhid", "iman", "taqwa", "shukr", "sabr", "akhlaq", "ihsan", "dua",
    "dhikr", "repentance", "mercy", "justice", "brotherhood", "ummah",
]


def _norm(q: str) -> str:
    return re.sub(r"\s+", " ", q.strip().lower())


def build_cases(target: int = TARGET_TOTAL) -> list[dict]:
    seen: set[str] = set()
    cases: list[dict] = []

    def add(
        q: str,
        types: list[str],
        needles: list[str],
        banned: list[str] | None = None,
        category: str = "general",
        tags: list[str] | None = None,
    ) -> None:
        key = _norm(q)
        if not key or key in seen:
            return
        seen.add(key)
        cases.append({
            "question": q.strip(),
            "expected_types": types,
            "must_contain": needles,
            "must_not_contain": banned or [],
            "category": category,
            "tags": tags or [],
        })

    for row in BEGINNER:
        add(*row, category="beginner")
    for row in OTHER_FAITH:
        add(*row, category="other_faith")
    for row in TRAVEL:
        add(*row, category="travel")
    for row in EXPERT:
        add(*row, category="expert")
    for row in REVERT:
        add(*row, category="revert")
    for row in KIDS:
        add(*row, category="kids")
    for row in DAILY_LIFE:
        add(*row, category="daily_life")
    for row in SALAH:
        add(*row, category="salah")

    for topic in HADITH_TOPICS:
        add(f"hadith about {topic}", ["hadith", "quran"], [topic, "Bukhari"], [], "hadith", [topic])
        add(f"what did Prophet say about {topic}", ["hadith"], [topic, "Prophet", "Bukhari"], [], "hadith", [topic])
        add(f"is there a hadith on {topic}", ["hadith"], [topic, "Bukhari"], [], "hadith", [topic])

    for num, name in SURAH_NAMES.items():
        short = name.split()[-1] if " " in name else name
        add(f"summarize surah {name}", ["quran"], [str(num), short], [], "surah", [short.lower()])
        add(f"what is surah {num} about", ["quran"], [str(num)], [], "surah", [short.lower()])
        add(f"is surah {name} makki or madani", ["quran"], [str(num), "Makki", "Madani", "Medinan"], [], "surah", [short.lower()])
        add(f"how many ayahs in surah {num}", ["quran"], [str(num), "ayah"], [], "surah", [short.lower()])

    for num in range(1, 115):
        count = AYAH_COUNTS.get(num, 50)
        for ayah in [1, 2, 3, 5, 7, 10, 14, 21, 28, 40, 50, 75, 100]:
            if ayah > count:
                continue
            vk = f"{num}:{ayah}"
            add(f"what is verse {vk}", ["quran"], [vk], ["Main teachings"], "verse", [vk])
            add(f"translate ayah {vk}", ["quran"], [vk], [], "verse", [vk])

    anchors = [
        "1:1", "1:5", "2:255", "2:286", "3:8", "4:34", "5:6", "12:53", "18:10", "24:35",
        "33:21", "36:1", "49:13", "55:1", "59:18", "67:1", "93:11", "112:1", "113:1", "114:1",
    ]
    for vk in anchors:
        for tmpl in TAFSIR_TEMPLATES:
            add(tmpl.format(vk=vk), ["quran", "tafsir"], [vk.split(":")[0], "meaning", "Tafsir"], [], "tafsir", [vk])
        add(f"explain tafsir for {vk}", ["tafsir", "quran"], [vk, "Tafsir"], [], "tafsir", [vk])

    for vk in anchors[:10]:
        add("what is the tafsir for that verse", ["tafsir", "quran"], ["Tafsir", vk.split(":")[0]], [], "followup", [vk])
        add("tell me more about the meaning", ["quran", "tafsir"], ["meaning"], [], "followup", [])
        add("why was this ayah revealed", ["tafsir", "quran"], ["revealed", "context"], [], "followup", [])

    for topic in DUA_TOPICS:
        add(f"dua for {topic}", ["dua", "quran", "hadith"], [topic], [], "dua", [topic])
        add(f"supplication for {topic} in Islam", ["dua", "hadith", "quran"], [topic], [], "dua", [topic])

    for topic in FAITH_TOPICS:
        add(f"what does Quran say about {topic}", ["quran", "hadith"], [topic], [], "faith", [topic])
        add(f"explain {topic} in Islam", ["quran", "hadith"], [topic], [], "faith", [topic])

    i = 0
    while len(cases) < target:
        num = (i % 114) + 1
        ayah = (i % min(AYAH_COUNTS.get(num, 7), 60)) + 1
        vk = f"{num}:{ayah}"
        name = SURAH_NAMES[num]
        templates = [
            f"what does Quran {vk} teach about faith",
            f"what lesson is in {name} ayah {ayah}",
            f"meaning of Quran {vk} in simple words",
            f"why is {vk} important",
        ]
        add(templates[i % len(templates)], ["quran"], [vk, str(num)], [], "generated", [vk])
        i += 1
        if i > target * 3:
            break

    return cases[:target]


def main() -> None:
    cases = build_cases(TARGET_TOTAL)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        json.dumps(
            {
                "version": 2,
                "total": len(cases),
                "categories": sorted({c["category"] for c in cases}),
                "cases": cases,
            },
            indent=2,
        )
    )
    print(f"Wrote {len(cases)} eval cases to {OUT}")


if __name__ == "__main__":
    main()
