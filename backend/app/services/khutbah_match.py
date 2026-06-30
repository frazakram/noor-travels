"""Match live khutba transcript against preloaded English khutbahs."""

from __future__ import annotations

import re
from dataclasses import dataclass
from functools import lru_cache

from app.db import get_cursor

ARABIC_RE = re.compile(r"[\u0600-\u06FF\u0750-\u077F]")
NON_WORD_RE = re.compile(r"[^\w\s]", re.UNICODE)


def normalize(text: str) -> str:
    text = text.lower()
    text = NON_WORD_RE.sub(" ", text)
    return re.sub(r"\s+", " ", text).strip()


def extract_english_only(text: str) -> str:
    """Keep paragraphs that are mostly English (for matching)."""
    parts: list[str] = []
    for block in re.split(r"[\n\r]+", text):
        block = block.strip()
        if len(block) < 20:
            continue
        arabic = len(ARABIC_RE.findall(block))
        if arabic > max(8, len(block) * 0.25):
            continue
        parts.append(block)
    return " ".join(parts)


def build_match_text(english_text: str) -> str:
    return normalize(extract_english_only(english_text))


@dataclass
class KhutbahRecord:
    id: int
    slug: str
    title: str
    source_url: str
    english_text: str
    match_text: str


@dataclass
class MatchResult:
    khutbah: KhutbahRecord
    score: float
    matched_phrase: str


@lru_cache(maxsize=1)
def _load_khutbah_index() -> tuple[list[KhutbahRecord], dict[str, list[tuple[str, int]]]]:
    """Load khutbahs and precomputed 8-word shingles per slug."""
    records: list[KhutbahRecord] = []
    shingles: dict[str, list[tuple[str, int]]] = {}

    with get_cursor() as cur:
        cur.execute(
            """
            SELECT id, slug, title, source_url, english_text, match_text
            FROM preloaded_khutbahs
            ORDER BY title
            """
        )
        rows = cur.fetchall()

    for row in rows:
        rec = KhutbahRecord(
            id=row["id"],
            slug=row["slug"],
            title=row["title"],
            source_url=row["source_url"],
            english_text=row["english_text"],
            match_text=row["match_text"],
        )
        records.append(rec)
        words = rec.match_text.split()
        rec_shingles: list[tuple[str, int]] = []
        for i in range(len(words) - 7):
            rec_shingles.append((" ".join(words[i : i + 8]), i))
        shingles[rec.slug] = rec_shingles

    return records, shingles


def clear_khutbah_index_cache() -> None:
    _load_khutbah_index.cache_clear()


def match_transcript(accumulated_english: str, min_words: int = 8) -> MatchResult | None:
    """Return best matching preloaded khutbah for accumulated live English text."""
    norm = normalize(accumulated_english)
    words = norm.split()
    if len(words) < min_words:
        return None

    _, shingle_index = _load_khutbah_index()
    if not shingle_index:
        return None

    # Build shingles from recent transcript (last ~60 words) and full accumulated text.
    recent_words = words[-60:]
    query_shingles: set[str] = set()
    for chunk in (words, recent_words):
        for i in range(len(chunk) - 7):
            query_shingles.add(" ".join(chunk[i : i + 8]))

    if not query_shingles:
        return None

    best: MatchResult | None = None
    records, _ = _load_khutbah_index()
    rec_by_slug = {r.slug: r for r in records}

    for slug, rec_shingles in shingle_index.items():
        hits = [s for s, _ in rec_shingles if s in query_shingles]
        if not hits:
            continue
        # Score: number of unique matching phrases + bonus for longer overlap
        score = len(set(hits)) * 2.0 + max(len(h.split()) for h in hits) * 0.1
        if best is None or score > best.score:
            best = MatchResult(
                khutbah=rec_by_slug[slug],
                score=score,
                matched_phrase=hits[0],
            )

    if best is None or best.score < 3.0:
        return None
    return best
