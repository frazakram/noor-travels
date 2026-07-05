#!/usr/bin/env python3
"""Merge hand-written curated Q&A into the question-library JSON files.

Idempotent: re-running replaces all previous curated (c-*) entries, so
editing curated_qa.py and re-running is the whole update workflow. The
auto-generated q-* entries are never touched, and curated entries are
pinned to the top of the index so they surface first.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from curated_qa import QUESTIONS  # noqa: E402

REPO = Path(__file__).resolve().parents[2]
OUT_DIR = REPO / "frontend" / "public" / "data"
INDEX_PATH = OUT_DIR / "question-library-index.json"
ANSWERS_PATH = OUT_DIR / "question-library-answers.json"
META_PATH = OUT_DIR / "question-library-meta.json"


def main() -> None:
    index = json.loads(INDEX_PATH.read_text())
    answers = json.loads(ANSWERS_PATH.read_text())

    kept_items = [item for item in index["items"] if not item["id"].startswith("c-")]
    answers = {k: v for k, v in answers.items() if not k.startswith("c-")}

    curated_items = []
    for i, q in enumerate(QUESTIONS):
        qid = f"c-{i + 1:04d}"
        curated_items.append(
            {
                "id": qid,
                "question": q["question"],
                "category": q["category"],
                "tags": q["tags"],
                "verified": True,
                "curated": True,
            }
        )
        answers[qid] = {
            "answer": q["answer"].strip(),
            "citations": [],
            "sources": q["sources"],
            "confidence": "high",
            "verified": True,
        }

    index["items"] = curated_items + kept_items
    index["total"] = len(index["items"])
    # Curated categories lead the filter row; the rest keep their order.
    curated_cats = list(dict.fromkeys(q["category"] for q in QUESTIONS))
    index["categories"] = curated_cats + [c for c in index["categories"] if c not in curated_cats]
    INDEX_PATH.write_text(json.dumps(index, ensure_ascii=False))
    ANSWERS_PATH.write_text(json.dumps(answers, ensure_ascii=False))

    if META_PATH.exists():
        meta = json.loads(META_PATH.read_text())
        meta["curated_count"] = len(curated_items)
        meta["total"] = len(index["items"])
        META_PATH.write_text(json.dumps(meta, ensure_ascii=False, indent=2))

    print(f"Merged {len(curated_items)} curated Q&A (total library: {len(index['items'])})")


if __name__ == "__main__":
    main()
