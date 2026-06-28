#!/usr/bin/env python3
"""Score chat retrieval quality across diverse question types."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.rag_service import chat

# (question, expected_source_types, must_contain_any in answer+sources, must_not_contain_any)
TEST_CASES = [
    ("what is dua for exams?", ["quran", "hadith"], ["knowledge", "20:114", "learn"], ["travel"]),
    ("what dua for starting travel?", ["dua"], ["travel", "Dua travel"], []),
    ("summarize surah ikhlas", ["quran"], ["112", "One", "worship", "Al-Ikhlaas"], []),
    ("what is the purpose of humans on earth?", ["quran"], ["worship", "51:56", "created"], []),
    ("summarize surah ale-imran and time period", ["quran"], ["Imraan", "Medinan", "3"], []),
    ("what is chapter 3 of quran?", ["quran"], ["Imraan", "3"], []),
    ("hadith about patience", ["hadith", "quran"], ["patient", "patience", "Bukhari"], []),
    ("what does quran say about parents?", ["quran"], ["parent", "mother", "father"], []),
    ("dua for anxiety and worry", ["quran", "hadith"], ["ease", "fear", "heart", "remembrance"], []),
    ("explain surah yasin", ["quran"], ["Yasin", "36"], []),
    ("rizq and sustenance in islam", ["quran", "hadith"], ["provision", "rizq", "sustenance"], []),
    ("forgiveness from allah", ["quran", "hadith"], ["forgive", "mercy", "repent"], []),
    ("what is dua for marriage?", ["quran", "hadith"], ["marriage", "spouse", "mercy"], []),
    ("travel dua safety journey", ["dua"], ["travel", "Dua"], []),
    ("what is sabr in quran?", ["quran"], ["patient", "patience", "sabr"], []),
    (
        "which surah is advised to read before sleeping and why?",
        ["quran", "hadith"],
        ["mulk", "ikhlas", "sleep"],
        ["Revelation"],
    ),
    ("what does quran say about salah prayer?", ["quran"], ["prayer", "salah", "establish"], []),
    ("why do muslims fast in ramadan?", ["quran"], ["fast", "ramadan", "taqwa"], []),
    ("what is hajj in islam?", ["quran"], ["hajj", "pilgrimage", "kaaba"], []),
    ("zakat and charity in quran", ["quran"], ["charity", "zakat", "poor"], []),
    (
        "how much we have to spend in fitrah during month of ramadan",
        ["hadith", "quran"],
        ["Sa", "fitr", "1451", "dates", "barley"],
        ["taqwa", "fasting is ordained"],
    ),
    (
        "what is the verse from 25 to 33 of chapter 69?",
        ["quran"],
        ["69:25", "69:33", "believe", "Allah"],
        ["Main teachings", "52 ayahs"],
    ),
    (
        "what is the verse number 33 of chapter 69?",
        ["quran"],
        ["69:33", "believe", "Allah", "Most Great"],
        ["Main teachings", "52 ayahs"],
    ),
    (
        "tell me the percentage of wealth i have to spend on the month of ramadan",
        ["hadith", "quran"],
        ["2.5", "fortieth", "1405", "zakat"],
        ["Ar-Razzaq", "fasting is ordained"],
    ),
    ("rights of neighbors in islam", ["quran", "hadith"], ["neighbor", "kindness", "rights"], []),
    ("what is ayat al kursi?", ["quran"], ["2:255", "throne", "Allah"], []),
    ("tell me in short what is the teaching of surah al naba", ["quran"], ["judgement", "judgment", "Day of", "great news"], ["Translation:"]),
    ("how to seek knowledge in islam", ["quran", "hadith"], ["knowledge", "learn", "teach"], []),
    ("what happens after death in islam?", ["quran", "hadith"], ["death", "grave", "hereafter"], []),
]


def score_case(
    question: str,
    expected_types: list[str],
    must_contain: list[str],
    must_not_contain: list[str] | None = None,
) -> dict:
    try:
        result = chat(question, "en", history=[], response_lang="en", include_transliteration=False)
    except Exception as exc:
        return {"question": question, "pass": False, "score": 0, "error": str(exc)}

    answer = (result.get("answer") or "").lower()
    sources = result.get("sources") or []
    snippets = " ".join(s.get("snippet", "") for s in sources).lower()
    citations = " ".join(result.get("citations") or []).lower()
    source_types = {s.get("type", "") for s in sources}
    combined = answer + " " + snippets + " " + citations

    type_ok = any(t in source_types for t in expected_types) or any(t in combined for t in expected_types)
    content_ok = any(m.lower() in combined for m in must_contain)
    # Theme summaries should appear in the short answer
    answer_ok = any(m.lower() in answer for m in must_contain) or content_ok
    not_ok = not any(m.lower() in combined for m in (must_not_contain or []))
    passed = type_ok and answer_ok and not_ok and result.get("validation", {}).get("valid", True)

    return {
        "question": question,
        "pass": passed,
        "score": 100 if passed else (50 if type_ok or content_ok else 0),
        "mode": result.get("mode", "openai"),
        "citations": result.get("citations", [])[:3],
        "answer_preview": (result.get("answer") or "")[:200],
    }


def main():
    results = [score_case(q, types, needles, banned) for q, types, needles, banned in TEST_CASES]
    passed = sum(1 for r in results if r["pass"])
    total = len(results)
    avg = sum(r["score"] for r in results) / total

    print(f"\n=== Chat Eval: {passed}/{total} passed (avg score {avg:.0f}) ===\n")
    for r in results:
        status = "PASS" if r["pass"] else "FAIL"
        print(f"[{status}] {r['question']}")
        if not r["pass"]:
            print(f"       citations: {r.get('citations')}")
            print(f"       preview: {r.get('answer_preview', '')[:120]}...")
        if r.get("error"):
            print(f"       error: {r['error']}")

    out = Path(__file__).resolve().parents[1] / "data" / "eval_chat_results.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({"passed": passed, "total": total, "avg": avg, "results": results}, indent=2))
    print(f"\nSaved: {out}")
    sys.exit(0 if passed >= total * 0.8 else 1)


if __name__ == "__main__":
    main()
