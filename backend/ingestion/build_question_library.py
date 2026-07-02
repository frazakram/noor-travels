#!/usr/bin/env python3
"""Pre-compute RAG answers for the question library (run locally, ship JSON to frontend)."""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path

os.environ.setdefault("FORCE_SQLITE", "1")

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parent
sys.path.insert(0, str(ROOT))

from ingestion.eval_chat import FOLLOWUP_CONTEXT, score_case  # noqa: E402
from ingestion.generate_eval_questions import TARGET_TOTAL, build_cases  # noqa: E402
from app.services.rag_service import _chat_local, _merge_history_context  # noqa: E402

OUT_DIR = REPO / "frontend" / "public" / "data"
INDEX_PATH = OUT_DIR / "question-library-index.json"
ANSWERS_PATH = OUT_DIR / "question-library-answers.json"
META_PATH = OUT_DIR / "question-library-meta.json"


def build_library(limit: int | None = None, resume: bool = False) -> dict:
    cases = build_cases(TARGET_TOTAL)
    if limit:
        cases = cases[:limit]

    index_map: dict[str, dict] = {}
    answers: dict[str, dict] = {}
    failed: list[dict] = []

    if resume and ANSWERS_PATH.exists():
        answers = json.loads(ANSWERS_PATH.read_text())
        if INDEX_PATH.exists():
            for item in json.loads(INDEX_PATH.read_text()).get("items", []):
                index_map[item["id"]] = item
        print(f"Resuming — {len(answers)} answers already built")

    started = time.time()
    for i, case in enumerate(cases):
        qid = f"q-{i + 1:04d}"
        if qid in answers:
            continue

        question = case["question"]
        history = FOLLOWUP_CONTEXT.get(question, [])
        standalone, history_verse_keys = _merge_history_context(question, history)

        try:
            result = _chat_local(
                question,
                "en",
                include_transliteration=False,
                intentional_local=True,
                standalone=standalone,
                history_verse_keys=history_verse_keys,
            )
            scored = score_case(case)
        except Exception as exc:
            failed.append({"id": qid, "question": question, "error": str(exc)})
            result = {
                "answer": "Answer could not be generated for this question.",
                "citations": [],
                "sources": [],
                "confidence": "low",
            }
            scored = {"pass": False}

        index_map[qid] = {
            "id": qid,
            "question": question,
            "category": case.get("category", "general"),
            "tags": case.get("tags", []),
            "verified": bool(scored.get("pass")),
        }
        answers[qid] = {
            "answer": result.get("answer") or "",
            "citations": result.get("citations") or [],
            "sources": (result.get("sources") or [])[:8],
            "confidence": result.get("confidence", "medium"),
            "verified": bool(scored.get("pass")),
        }
        if not scored.get("pass"):
            failed.append({"id": qid, "question": question, "preview": answers[qid]["answer"][:120]})

        if (i + 1) % 50 == 0 or i + 1 == len(cases):
            elapsed = time.time() - started
            print(f"  {i + 1}/{len(cases)} built ({elapsed:.0f}s)")
            _write_outputs(list(index_map.values()), answers, failed, len(cases))

    meta = _write_outputs(list(index_map.values()), answers, failed, len(cases))
    return meta


def _write_outputs(index: list[dict], answers: dict, failed: list, total: int) -> dict:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    categories = sorted({item["category"] for item in index})
    verified = sum(1 for item in index if item.get("verified"))

    index_payload = {
        "version": 1,
        "total": len(index),
        "categories": categories,
        "items": sorted(index, key=lambda x: x["id"]),
    }
    INDEX_PATH.write_text(json.dumps(index_payload, ensure_ascii=False))
    ANSWERS_PATH.write_text(json.dumps(answers, ensure_ascii=False))

    meta = {
        "version": 1,
        "total": total,
        "built": len(index),
        "verified": verified,
        "failed": len(failed),
        "failures": failed[:50],
    }
    META_PATH.write_text(json.dumps(meta, indent=2))
    return meta


def main() -> None:
    parser = argparse.ArgumentParser(description="Build pre-loaded question library JSON")
    parser.add_argument("--limit", type=int, default=None, help="Build only first N questions (test)")
    parser.add_argument("--resume", action="store_true", help="Resume from partial build")
    args = parser.parse_args()

    meta = build_library(limit=args.limit, resume=args.resume)
    print(f"\nLibrary written to {OUT_DIR}")
    print(f"  Index:   {INDEX_PATH.name} ({INDEX_PATH.stat().st_size // 1024} KB)")
    print(f"  Answers: {ANSWERS_PATH.name} ({ANSWERS_PATH.stat().st_size // 1024} KB)")
    print(f"  Verified: {meta['verified']}/{meta['built']}  Failed checks: {meta['failed']}")
    if meta["failed"]:
        sys.exit(1)


if __name__ == "__main__":
    main()
