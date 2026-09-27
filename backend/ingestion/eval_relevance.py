"""Relevance eval for chat: does the answer cite the sources a correct answer must cite?

eval_chat.py checks keyword presence, which a confidently wrong template answer can
pass. Each case here lists acceptable citation prefixes; a case passes only when at
least one citation starts with one of them and no forbidden phrase appears.

    FORCE_SQLITE=1 .venv/bin/python ingestion/eval_relevance.py
"""

import os
import re
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ.setdefault("FORCE_SQLITE", "1")

from app.services import rag_service  # noqa: E402
from app.services.rag_service import chat  # noqa: E402

CASES: list[dict] = [
    {"q": "Explain Surah Al-Asr", "expect": ["Quran 103:"], "forbid": ["shadow", "Hanafi"]},
    {"q": "What is Surah Al-Asr about?", "expect": ["Quran 103:"], "forbid": ["shadow"]},
    {"q": "Explain Surah Al-Fatiha", "expect": ["Quran 1:"]},
    {"q": "What is the meaning of Ayat al-Kursi?", "expect": ["Quran 2:255"]},
    {"q": "What does Islam say about backbiting?", "expect": ["Quran 49:12"]},
    {"q": "Tell me the story of Prophet Yunus and the whale", "expect": ["Quran 37:139", "Quran 37:14", "Quran 21:87", "Quran 21:88", "Quran 68:48"]},
    {"q": "What does the Quran say about patience?", "expect": ["Quran 2:153", "Quran 2:155", "Quran 3:200", "Quran 2:45"]},
    {"q": "Is taking interest (riba) allowed?", "expect": ["Quran 2:275", "Quran 2:278", "Quran 2:279", "Quran 3:130"]},
    {"q": "Why do Muslims fast in Ramadan?", "expect": ["Quran 2:183", "Quran 2:185"]},
    {"q": "What is the dua before sleeping?", "expect": ["Dua ", "Sahih al-Bukhari", "Quran 2:255", "Quran 67:", "Quran 112:"]},
    {"q": "When does Asr prayer start according to Hanafi fiqh?", "expect": ["Sahih al-Bukhari", "Quran 2:238"]},
    {"q": "How should we treat our parents?", "expect": ["Quran 17:23", "Quran 17:24", "Quran 31:14", "Quran 46:15"]},
    {"q": "What does the Quran say about the creation of the heavens and earth in six days?", "expect": ["Quran 7:54", "Quran 10:3", "Quran 11:7", "Quran 25:59", "Quran 32:4", "Quran 50:38", "Quran 57:4"]},
    {"q": "Can I combine Dhuhr and Asr while travelling?", "expect": ["Sahih al-Bukhari 10"], "forbid": ["Surah Al-Asr", "Declining Day"]},
    {"q": "Is it allowed to pray Fajr late if I overslept?", "expect": ["Sahih al-Bukhari", "Quran 2:238", "Quran 4:103", "Quran 17:78", "Quran 20:14"], "forbid": ["Surah Al-Fajr"]},
    {"q": "Surah Al-Fajr summary", "expect": ["Quran 89:"]},
    {"q": "where it is written to have beard ?", "expect": ["Sahih al-Bukhari 5665", "Sahih al-Bukhari 5666"]},
    {"q": "What is the punishment for lying?", "expect": ["Sahih al-Bukhari 5862", "Quran 40:28", "Quran 16:105", "Quran 39:3"], "forbid": ["menses"]},
    {"q": "kya namaz qasr kar sakte hain safar mein?", "expect": ["Sahih al-Bukhari 10", "Quran 4:101"]},
    {"q": "What does Islam teach about honesty in trade?", "expect": ["Sahih al-Bukhari", "Quran 83:", "Quran 2:282", "Quran 4:29", "Quran 17:35"]},
    # Conversations. A new topic must be answered on its own, never mixed with the previous one
    # (the bug behind "Pagans are..." answering a food question); a real follow-up must carry it.
    {
        "q": "Which food is halal for muslims?",
        "history": [
            {"role": "user", "content": "Who are pagans?"},
            {"role": "assistant", "content": "Pagans are those who associate partners with Allah [Quran 9:5]."},
        ],
        "expect": ["Quran 5:", "Quran 6:145", "Quran 2:168", "Quran 2:172", "Quran 2:173", "Quran 16:114", "Quran 16:115"],
        "forbid": ["pagan", "polytheist", "could not find"],
    },
    {
        "q": "Is lying ever allowed?",
        "history": [
            {"role": "user", "content": "where it is written to have beard ?"},
            {"role": "assistant", "content": "Cut the moustaches short and leave the beard [Sahih al-Bukhari 5666]."},
        ],
        "expect": ["Sahih al-Bukhari 5862", "Sahih al-Bukhari 2692", "Quran 40:28", "Quran 16:105", "Quran 39:3", "Quran 16:106"],
        "forbid": ["beard", "moustache"],
    },
    {
        "q": "Explain it in more detail",
        "history": [
            {"role": "user", "content": "What is Ayat al-Kursi?"},
            {"role": "assistant", "content": "Ayat al-Kursi is Quran 2:255, about Allah's knowledge and throne."},
        ],
        "expect": ["Quran 2:255"],
    },
    {
        "q": "What about while travelling?",
        "history": [
            {"role": "user", "content": "How many rakat is Zuhr prayer?"},
            {"role": "assistant", "content": "Zuhr is four rakat for a resident."},
        ],
        "expect": ["Sahih al-Bukhari 10", "Quran 4:101"],
    },
]


def _cites(citation: str, expected: str) -> bool:
    """'Quran 37:14' matches 'Quran 37:142' and 'Tafsir 37:142 (ibn_kathir_en)' — same verse, either source."""
    citation = citation.strip("[]")
    if citation.startswith(expected):
        return True
    if expected.startswith("Quran "):
        key = expected.removeprefix("Quran ")
        verse = re.search(r"(\d+:\d+)", citation)
        return bool(verse) and verse.group(1).startswith(key)
    return False


def run(only: str = "") -> int:
    """only: run just the cases whose question contains this text (for iterating on a failure)."""
    cases = [c for c in CASES if only.lower() in c["q"].lower()]
    passed = 0
    llm_used = 0
    for case in cases:
        started = time.perf_counter()
        # Bypass the answer cache so every run measures the current pipeline.
        original_get = rag_service.get_cached
        rag_service.get_cached = lambda _key: None
        try:
            result = chat(case["q"], lang="en", history=case.get("history"), include_transliteration=False)
        finally:
            rag_service.get_cached = original_get
        elapsed = time.perf_counter() - started
        citations = result.get("citations") or []
        answer = result.get("answer") or ""
        mode = result.get("mode", "llm")
        hit = any(_cites(str(c), expected) for c in citations for expected in case["expect"])
        clean = not any(f.lower() in answer.lower() for f in case.get("forbid", []))
        ok = hit and clean
        passed += ok
        llm_used += not str(mode).endswith("_local")
        status = "PASS" if ok else "FAIL"
        print(f"[{status}] {elapsed:4.1f}s mode={mode:<11} {case['q']}")
        if not ok:
            print(f"        cites={citations[:4]}")
            print(f"        answer={answer[:140]!r}")
    print(f"\n=== Relevance: {passed}/{len(cases)} passed · LLM used for {llm_used}/{len(cases)} ===")
    return 0 if passed == len(cases) else 1


if __name__ == "__main__":
    sys.exit(run(sys.argv[1] if len(sys.argv) > 1 else ""))
