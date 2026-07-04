"""Match live khutba transcript against preloaded khutbahs.

Three tiers, checked in order:
1. Arabic exact — the library pages embed the Arabic verses/duas each khutbah
   quotes; when the imam recites them verbatim the normalized Whisper
   transcript overlaps in 5-word runs. No translation step to blur wording.
2. English exact — 8-word shingle overlap against the library's English text.
3. English fuzzy — IDF-weighted token containment that tolerates a different
   translation of the same khutbah. Lower confidence, so callers surface it
   as a suggestion instead of stopping the live session.
"""

from __future__ import annotations

import math
import re
from dataclasses import dataclass
from functools import lru_cache

from app.db import get_cursor

ARABIC_RE = re.compile(r"[\u0600-\u06FF\u0750-\u077F]")
NON_WORD_RE = re.compile(r"[^\w\s]", re.UNICODE)
# Harakat, Quranic annotation marks, superscript alef, tatweel.
AR_MARKS_RE = re.compile(r"[\u064B-\u065F\u0670\u0640\u06D6-\u06ED]")
AR_NON_LETTER_RE = re.compile(r"[^\u0621-\u064A\s]")

EN_SHINGLE = 8
AR_SHINGLE = 5
EN_EXACT_THRESHOLD = 12.0
AR_EXACT_THRESHOLD = 10.0
FUZZY_MIN_WORDS = 60
FUZZY_THRESHOLD = 0.35
FUZZY_MARGIN = 1.3


def normalize(text: str) -> str:
    text = text.lower()
    text = NON_WORD_RE.sub(" ", text)
    return re.sub(r"\s+", " ", text).strip()


def normalize_arabic(text: str) -> str:
    """Collapse orthographic variants so Whisper output matches typed text."""
    text = AR_MARKS_RE.sub("", text)
    text = re.sub("[أإآٱ]", "ا", text)
    text = text.replace("ى", "ي").replace("ة", "ه")
    text = AR_NON_LETTER_RE.sub(" ", text)
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
    tier: str = "exact"  # "exact" (safe to auto-open) or "fuzzy" (suggest only)


def _shingles(words: list[str], size: int) -> list[str]:
    return [" ".join(words[i : i + size]) for i in range(len(words) - size + 1)]


def _fuzzy_tokens(words: list[str]) -> set[str]:
    return set(words) | {f"{a} {b}" for a, b in zip(words, words[1:])}


@dataclass
class KhutbahIndex:
    records: list[KhutbahRecord]
    en_shingles: dict[str, list[str]]
    ar_shingles: dict[str, list[str]]
    doc_tokens: dict[str, set[str]]
    idf: dict[str, float]


@lru_cache(maxsize=1)
def _load_khutbah_index() -> KhutbahIndex:
    records: list[KhutbahRecord] = []
    raw_en: dict[str, list[str]] = {}
    raw_ar: dict[str, list[str]] = {}
    doc_tokens: dict[str, set[str]] = {}

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
        en_words = rec.match_text.split()
        raw_en[rec.slug] = _shingles(en_words, EN_SHINGLE)
        # The Arabic quotations live inside english_text; normalize_arabic
        # drops everything that isn't an Arabic letter.
        raw_ar[rec.slug] = _shingles(normalize_arabic(rec.english_text).split(), AR_SHINGLE)
        doc_tokens[rec.slug] = _fuzzy_tokens(en_words)

    # Openings like "all praise is due to allah..." (and shared duas/verses on
    # the Arabic side) appear in nearly every khutbah; matching on them stops
    # live listening with the wrong sermon. Keep phrases unique to at most two.
    def df_filter(raw: dict[str, list[str]]) -> dict[str, list[str]]:
        doc_freq: dict[str, int] = {}
        for rec_shingles in raw.values():
            for s in set(rec_shingles):
                doc_freq[s] = doc_freq.get(s, 0) + 1
        return {slug: [s for s in rec_shingles if doc_freq[s] <= 2] for slug, rec_shingles in raw.items()}

    n_docs = max(len(records), 1)
    token_df: dict[str, int] = {}
    for tokens in doc_tokens.values():
        for tok in tokens:
            token_df[tok] = token_df.get(tok, 0) + 1
    idf = {tok: math.log(n_docs / df) for tok, df in token_df.items() if df < n_docs}

    return KhutbahIndex(
        records=records,
        en_shingles=df_filter(raw_en),
        ar_shingles=df_filter(raw_ar),
        doc_tokens=doc_tokens,
        idf=idf,
    )


def clear_khutbah_index_cache() -> None:
    _load_khutbah_index.cache_clear()


def _best_shingle_match(
    query_words: list[str],
    shingle_index: dict[str, list[str]],
    rec_by_slug: dict[str, KhutbahRecord],
    size: int,
    recent: int,
) -> MatchResult | None:
    query_shingles: set[str] = set()
    for chunk in (query_words, query_words[-recent:]):
        query_shingles.update(_shingles(chunk, size))
    if not query_shingles:
        return None

    best: MatchResult | None = None
    for slug, rec_shingles in shingle_index.items():
        hits = set(rec_shingles) & query_shingles
        if not hits:
            continue
        score = len(hits) * 2.0 + size * 0.1
        if best is None or score > best.score:
            best = MatchResult(khutbah=rec_by_slug[slug], score=score, matched_phrase=next(iter(hits)))
    return best


def match_transcript(
    accumulated_english: str,
    accumulated_arabic: str = "",
    min_words: int = 8,
) -> MatchResult | None:
    """Return best matching preloaded khutbah for accumulated live text."""
    index = _load_khutbah_index()
    if not index.records:
        return None
    rec_by_slug = {r.slug: r for r in index.records}

    # Tier 1: Arabic verbatim — strongest signal when the imam speaks Arabic.
    ar_words = normalize_arabic(accumulated_arabic).split()
    if len(ar_words) >= AR_SHINGLE * 2:
        best = _best_shingle_match(ar_words, index.ar_shingles, rec_by_slug, AR_SHINGLE, recent=80)
        if best and best.score >= AR_EXACT_THRESHOLD:
            return best

    en_words = normalize(accumulated_english).split()
    if len(en_words) < min_words:
        return None

    # Tier 2: English verbatim. Verbatim passages score 40+; boilerplate
    # openings score ~5, so several distinct phrase hits are required.
    best = _best_shingle_match(en_words, index.en_shingles, rec_by_slug, EN_SHINGLE, recent=60)
    if best and best.score >= EN_EXACT_THRESHOLD:
        return best

    # Tier 3: fuzzy — a different English rendering of the same khutbah won't
    # share 8-word runs, but its distinctive vocabulary still concentrates in
    # one document. Containment: how much of the query's rare-token mass one
    # khutbah covers. Needs enough accumulated speech to be meaningful.
    if len(en_words) < FUZZY_MIN_WORDS:
        return None
    query_tokens = _fuzzy_tokens(en_words)
    query_mass = sum(index.idf.get(t, 0.0) ** 2 for t in query_tokens)
    if query_mass <= 0:
        return None

    scored: list[tuple[float, str]] = []
    for slug, tokens in index.doc_tokens.items():
        shared = sum(index.idf.get(t, 0.0) ** 2 for t in query_tokens & tokens)
        if shared > 0:
            scored.append((shared / query_mass, slug))
    scored.sort(reverse=True)
    if not scored or scored[0][0] < FUZZY_THRESHOLD:
        return None
    if len(scored) > 1 and scored[0][0] < scored[1][0] * FUZZY_MARGIN:
        return None
    containment, slug = scored[0]
    return MatchResult(khutbah=rec_by_slug[slug], score=containment, matched_phrase="", tier="fuzzy")
