"""Split the question-library answers into small static shards the site fetches on demand.

The shard for an id is FNV-1a(id) % SHARD_COUNT. frontend/lib/library-shards.ts must
compute the exact same function — a frontend test checks every id against these files.
"""

import json
import shutil
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
CANONICAL_ANSWERS = REPO / "backend" / "ingestion" / "data" / "question-library-answers.json"
SHARD_DIR = REPO / "frontend" / "public" / "data" / "answers"
SHARD_COUNT = 128


def shard_of(item_id: str) -> int:
    h = 0x811C9DC5
    for byte in item_id.encode("utf-8"):
        h ^= byte
        h = (h * 0x01000193) & 0xFFFFFFFF
    return h % SHARD_COUNT


def write_answer_shards(answers: dict) -> None:
    shards: dict[int, dict] = {}
    for item_id, answer in answers.items():
        shards.setdefault(shard_of(item_id), {})[item_id] = answer
    if SHARD_DIR.exists():
        shutil.rmtree(SHARD_DIR)
    SHARD_DIR.mkdir(parents=True)
    for index in range(SHARD_COUNT):
        (SHARD_DIR / f"{index}.json").write_text(json.dumps(shards.get(index, {}), ensure_ascii=False))


if __name__ == "__main__":
    write_answer_shards(json.loads(CANONICAL_ANSWERS.read_text()))
    sizes = sorted(p.stat().st_size for p in SHARD_DIR.glob("*.json"))
    print(f"{len(sizes)} shards in {SHARD_DIR} — largest {sizes[-1] // 1024} KB, median {sizes[len(sizes) // 2] // 1024} KB")
