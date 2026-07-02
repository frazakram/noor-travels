#!/usr/bin/env python3
"""Score chat retrieval quality across diverse question types (RAG-first, no LLM)."""
import argparse
import json
import os
import sys
from collections import defaultdict
from pathlib import Path

# Eval always uses local SQLite — avoids slow/hung remote Postgres connections.
os.environ.setdefault("FORCE_SQLITE", "1")

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.rag_service import _chat_local, _merge_history_context

DATA_DIR = Path(__file__).resolve().parents[1] / "data"
QUESTIONS_FILE = DATA_DIR / "eval_questions.json"
LEGACY_CASES = [
    ("what is dua for exams?", ["quran", "hadith"], ["knowledge", "20:114", "learn"], ["travel"]),
    ("what dua for starting travel?", ["dua"], ["travel", "Dua"], []),
    ("summarize surah ikhlas", ["quran"], ["112", "One", "worship", "Al-Ikhlaas"], []),
    ("explain tafsir of Quran 2:255", ["quran", "tafsir"], ["2:255", "Tafsir", "throne"], []),
    ("what is the verse number 33 of chapter 69?", ["quran"], ["69:33", "believe", "Allah"], ["Main teachings"]),
]

FOLLOWUP_CONTEXT = {
    "what is the tafsir for that verse": [
        {"role": "user", "content": "What is ayat al kursi?"},
        {"role": "assistant", "content": "Ayat al-Kursi is Quran 2:255 about Allah's throne."},
    ],
    "tell me more about the meaning": [
        {"role": "user", "content": "Explain Quran 36:1"},
        {"role": "assistant", "content": "Surah Yasin begins at Quran 36:1."},
    ],
    "why was this ayah revealed": [
        {"role": "user", "content": "What is verse 2:286?"},
        {"role": "assistant", "content": "Quran 2:286 is the last verse of Al-Baqarah."},
    ],
}


def load_cases(limit: int | None = None) -> list[dict]:
    if QUESTIONS_FILE.exists():
        payload = json.loads(QUESTIONS_FILE.read_text())
        cases = payload.get("cases", [])
    else:
        cases = [
            {
                "question": q,
                "expected_types": types,
                "must_contain": needles,
                "must_not_contain": banned or [],
                "category": "legacy",
            }
            for q, types, needles, banned in LEGACY_CASES
        ]
    return cases[:limit] if limit else cases


def score_case(case: dict) -> dict:
    question = case["question"]
    expected_types = case.get("expected_types", [])
    must_contain = case.get("must_contain", [])
    must_not_contain = case.get("must_not_contain", [])
    history = FOLLOWUP_CONTEXT.get(question, [])

    try:
        standalone, history_verse_keys = _merge_history_context(question, history)
        result = _chat_local(
            question,
            "en",
            include_transliteration=False,
            intentional_local=True,
            standalone=standalone,
            history_verse_keys=history_verse_keys,
        )
    except Exception as exc:
        return {
            "question": question,
            "category": case.get("category", "general"),
            "pass": False,
            "score": 0,
            "error": str(exc),
        }

    answer = (result.get("answer") or "").lower()
    sources = result.get("sources") or []
    snippets = " ".join(s.get("snippet", "") for s in sources).lower()
    citations = " ".join(result.get("citations") or []).lower()
    source_types = {s.get("type", "") for s in sources}
    combined = answer + " " + snippets + " " + citations

    type_ok = any(t in source_types for t in expected_types) or any(t in combined for t in expected_types)
    content_ok = any(m.lower() in combined for m in must_contain) if must_contain else True
    answer_ok = (
        any(m.lower() in answer for m in must_contain)
        or content_ok
        or len(answer.strip()) > 40
    )
    not_ok = not any(m.lower() in combined for m in must_not_contain)
    has_answer = len((result.get("answer") or "").strip()) > 15
    passed = type_ok and answer_ok and not_ok and has_answer and result.get("validation", {}).get("valid", True)

    return {
        "question": question,
        "category": case.get("category", "general"),
        "pass": passed,
        "score": 100 if passed else (50 if type_ok or content_ok else 0),
        "mode": result.get("mode", "local"),
        "citations": result.get("citations", [])[:3],
        "answer_preview": (result.get("answer") or "")[:200],
        "source_types": sorted(source_types),
    }


def main():
    parser = argparse.ArgumentParser(description="Run Noor Safar RAG eval suite")
    parser.add_argument("--limit", type=int, default=None, help="Max questions to run")
    parser.add_argument("--category", type=str, default=None, help="Filter by category")
    parser.add_argument("--generate", action="store_true", help="Regenerate eval_questions.json first")
    args = parser.parse_args()

    if args.generate:
        from ingestion.generate_eval_questions import main as gen_main

        gen_main()

    cases = load_cases(args.limit)
    if args.category:
        cases = [c for c in cases if c.get("category") == args.category]

    results = [score_case(c) for c in cases]
    passed = sum(1 for r in results if r["pass"])
    total = len(results)
    avg = sum(r["score"] for r in results) / total if total else 0

    buckets: dict[str, list[dict]] = defaultdict(list)
    for r in results:
        buckets[r.get("category", "general")].append(r)

    print(f"\n=== Chat Eval: {passed}/{total} passed (avg score {avg:.0f}) ===\n")
    for cat, rows in sorted(buckets.items()):
        cat_pass = sum(1 for r in rows if r["pass"])
        print(f"  {cat}: {cat_pass}/{len(rows)}")

    failures = [r for r in results if not r["pass"]]
    print(f"\nFailures: {len(failures)}")
    for r in failures[:25]:
        print(f"[FAIL] ({r.get('category')}) {r['question']}")
        print(f"       types={r.get('source_types')} preview={r.get('answer_preview', '')[:100]}")

    out = DATA_DIR / "eval_chat_results.json"
    out.write_text(
        json.dumps(
            {
                "passed": passed,
                "total": total,
                "avg": avg,
                "by_category": {k: sum(1 for r in v if r["pass"]) for k, v in buckets.items()},
                "results": results,
            },
            indent=2,
        )
    )
    print(f"\nSaved: {out}")
    sys.exit(0 if passed >= total * 0.75 else 1)


if __name__ == "__main__":
    main()
