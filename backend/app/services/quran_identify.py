"""Screenshot verse identifier: match OCR'd text (Arabic or English translation,
extracted client-side — no LLM/vision API involved anywhere in this path) against
the Quran to find the source surah:ayah.

Two independent matching passes, either or both of which can fire on a single
request (a screenshot can carry an Arabic ayah graphic plus an English caption):

- Arabic: near-exact fuzzy match (difflib) against canonical ayah text, normalized
  with the same `normalize_arabic()` recitation scoring already uses. Runs fully
  in-process, no external call.
- English: semantic match via the same embedding call the RAG chat uses
  (`embed_texts`, same live model/provider), but compared against a dedicated
  English-translation-only precomputed index rather than `document_chunks`.
  `document_chunks` embeds "Quran {verse_key}. Arabic: ... English: ... Urdu: ..."
  combined per ayah — fine for the RAG chat's thematic retrieval, but empirically
  too diluted for this feature: an exact Bismillah translation quote scored only
  ~0.64 cosine similarity against its own verse via document_chunks, vs. ~0.98
  against a clean English-only embedding. See scripts/build_quran_en_embeddings.py
  for how the precomputed index is generated (one-off, offline).

No free-form guessing — every candidate returned is a real row from the Quran
tables, never an LLM-recalled reference.
"""

import json
import re
from difflib import SequenceMatcher
from functools import lru_cache
from pathlib import Path

import numpy as np

from app.core.config import get_settings
from app.db import get_cursor
from app.services.embedding_service import embed_texts
from app.services.text_normalize import normalize_arabic

_DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"

# Below this, an Arabic candidate isn't returned at all — too weak to be useful.
ARABIC_RATIO_FLOOR = 0.45
ARABIC_RATIO_HIGH = 0.80
ARABIC_RATIO_MEDIUM = 0.60

# Candidates kept after the cheap quick_ratio() prefilter, before the real (slower) ratio() pass.
ARABIC_QUICK_PREFILTER_N = 40

ENGLISH_SIMILARITY_HIGH = 0.75
ENGLISH_SIMILARITY_MEDIUM = 0.60

# Floor for the plain-text fuzzy pass over English translations (see _match_english_exact) —
# same coverage-score scale as the Arabic path, different constant since it's a distinct signal.
ENGLISH_EXACT_FLOOR = 0.45
ENGLISH_EXACT_PREFILTER_N = 60

_EN_NON_ALNUM = re.compile(r"[^a-z0-9 ]")


def normalize_english(text: str) -> str:
    """Lowercase, strip punctuation — enough to compare OCR'd/typed English against
    the stored translation text on equal footing (mirrors normalize_arabic's role)."""
    t = _EN_NON_ALNUM.sub(" ", text.lower())
    return re.sub(r"\s+", " ", t).strip()

# Fraction of alphabetic characters that must be in the Arabic block to run each path.
ARABIC_SCRIPT_FLOOR = 0.15
ARABIC_SCRIPT_CEILING = 0.85


def _arabic_char_ratio(text: str) -> float:
    """Fraction of alphabetic characters in the Arabic Unicode block (\\u0600-\\u06FF,
    covers letters and diacritics) — decides which matching pass(es) to run."""
    letters = [c for c in text if c.isalpha()]
    if not letters:
        return 0.0
    arabic = sum(1 for c in letters if "؀" <= c <= "ۿ")
    return arabic / len(letters)


def _script_label(ratio: float) -> str:
    if ratio >= ARABIC_SCRIPT_CEILING:
        return "arabic"
    if ratio < ARABIC_SCRIPT_FLOOR:
        return "english"
    return "mixed"


def _tier_arabic(score: float) -> str:
    if score >= ARABIC_RATIO_HIGH:
        return "high"
    if score >= ARABIC_RATIO_MEDIUM:
        return "medium"
    return "low"


def _tier_english(score: float) -> str:
    if score >= ENGLISH_SIMILARITY_HIGH:
        return "high"
    if score >= ENGLISH_SIMILARITY_MEDIUM:
        return "medium"
    return "low"


@lru_cache(maxsize=1)
def _load_ayah_cache() -> tuple[dict, ...]:
    """All ayahs, normalized once and cached for the life of the process —
    ~6236 rows, well under 1MB, cheap to keep warm between requests."""
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT verse_key, surah_number, ayah_number, arabic,
                   translation_en, translation_ur, translation_hi
            FROM ayahs
            ORDER BY surah_number, ayah_number
            """
        )
        rows = cur.fetchall()
    out = []
    for r in rows:
        norm = normalize_arabic(r["arabic"])
        en_norm = normalize_english(r["translation_en"] or "")
        en_words = tuple(en_norm.split())
        out.append(
            {
                **dict(r),
                "arabic_norm": norm,
                "trigrams": _trigrams(norm),
                "en_words": en_words,
                "en_word_set": frozenset(en_words),
            }
        )
    return tuple(out)


def _trigrams(text: str) -> frozenset[str]:
    """Character trigrams (over the normalized text with spaces collapsed) — used as
    a length-neutral overlap prefilter. Word-level overlap would undercount OCR
    snippets that merge/split words differently than the canonical text."""
    compact = text.replace(" ", "")
    if len(compact) < 3:
        return frozenset({compact}) if compact else frozenset()
    return frozenset(compact[i : i + 3] for i in range(len(compact) - 2))


@lru_cache(maxsize=1)
def _ayah_by_verse_key() -> dict:
    return {row["verse_key"]: row for row in _load_ayah_cache()}


def _candidate(row: dict, *, score: float, match_type: str, confidence: str) -> dict:
    return {
        "verse_key": row["verse_key"],
        "surah_number": row["surah_number"],
        "ayah_number": row["ayah_number"],
        "arabic": row["arabic"],
        "translation_en": row["translation_en"],
        "translation_ur": row["translation_ur"],
        "translation_hi": row["translation_hi"],
        "match_type": match_type,
        "confidence": confidence,
        "score": round(score, 4),
    }


def match_arabic(query_text: str, top_k: int = 5) -> list[dict]:
    q_norm = normalize_arabic(query_text)
    if not q_norm:
        return []
    cache = _load_ayah_cache()
    q_trigrams = _trigrams(q_norm)

    # Pass 1: trigram-overlap prefilter. NOT length-normalized on purpose — a screenshot
    # is very often a partial excerpt of a longer ayah (Ayat al-Kursi being the classic
    # case), and a length-normalized score like SequenceMatcher.quick_ratio() would
    # unfairly punish a short-but-accurate query against a much longer ayah, potentially
    # dropping the correct verse out of the shortlist entirely.
    prelim = [
        (len(q_trigrams & row["trigrams"]), row) for row in cache
    ]
    prelim.sort(key=lambda pair: pair[0], reverse=True)
    shortlist = [row for _, row in prelim[:ARABIC_QUICK_PREFILTER_N]]

    # Pass 2: real matching-block coverage on the shortlist — how much of the QUERY
    # is found (in order) within the ayah, not a symmetric whole-string ratio. This is
    # what makes a clean partial quote of a long ayah still score near 1.0.
    scored = []
    for row in shortlist:
        sm = SequenceMatcher(None, q_norm, row["arabic_norm"], autojunk=False)
        matched = sum(block.size for block in sm.get_matching_blocks())
        score = min(matched / len(q_norm), 1.0)
        scored.append((score, row))
    scored.sort(key=lambda pair: pair[0], reverse=True)

    return [
        _candidate(row, score=score, match_type="arabic", confidence=_tier_arabic(score))
        for score, row in scored[:top_k]
        if score >= ARABIC_RATIO_FLOOR
    ]


@lru_cache(maxsize=1)
def _load_english_embeddings() -> tuple[np.ndarray, list[str]]:
    """Row-normalized [N, dim] matrix (unit vectors, so cosine similarity is just a
    dot product) + parallel verse_key list, from the offline precompute script."""
    matrix = np.load(_DATA_DIR / "quran_en_embeddings.npy")
    with open(_DATA_DIR / "quran_en_verse_keys.json", encoding="utf-8") as f:
        verse_keys = json.load(f)
    norms = np.linalg.norm(matrix, axis=1, keepdims=True)
    norms[norms == 0] = 1
    return matrix / norms, verse_keys


_OCR_NOISE_TOKEN = re.compile(r"[A-Za-z']+")


def _strip_ocr_noise(text: str) -> str:
    """For the embedding pass only: drop tokens that are almost certainly OCR
    misreads of a decorative/stylized font rather than real words — e.g. digit-
    mixed fragments ("l8", "1p") and bare symbols. A garbled screenshot's junk
    line(s) otherwise get embedded as part of the query, shifting its semantic
    vector away from the real caption. Threshold is 2 chars, not 3+ — English
    carries real short words ("we", "it", "to") that a stricter cut would drop
    along with the noise, which empirically hurt matching more than it helped."""
    kept = [w for w in _OCR_NOISE_TOKEN.findall(text) if len(w) >= 2]
    return " ".join(kept) if kept else text


def _match_english_semantic(query_text: str, top_k: int = 5) -> list[dict]:
    """Catches paraphrases and loose wording — weak on a short verbatim excerpt of a
    long multi-sentence ayah, since one whole-ayah embedding represents the average
    of everything in it, not any single sentence within it (see _match_english_exact)."""
    settings = get_settings()
    embeddings = embed_texts([_strip_ocr_noise(query_text)])
    if not embeddings:
        return []
    query_vec = np.array(embeddings[0], dtype=np.float32)
    norm = np.linalg.norm(query_vec)
    if norm == 0:
        return []
    query_vec /= norm

    matrix, verse_keys = _load_english_embeddings()
    similarities = matrix @ query_vec
    # Grab extra candidates before the floor cut — some may not clear rag_min_similarity.
    top_indices = np.argsort(-similarities)[: top_k * 4]

    by_verse_key = _ayah_by_verse_key()
    candidates = []
    for idx in top_indices:
        score = float(similarities[idx])
        if score < settings.rag_min_similarity:
            break  # sorted descending, nothing after this clears the floor either
        row = by_verse_key.get(verse_keys[idx])
        if not row:
            continue
        candidates.append(
            _candidate(row, score=score, match_type="english", confidence=_tier_english(score))
        )
        if len(candidates) >= top_k:
            break
    return candidates


def _match_english_exact(query_text: str, top_k: int = 5) -> list[dict]:
    """Plain fuzzy text match against translation_en — the English mirror of
    match_arabic's trigram-prefilter + matching-block-coverage approach. Catches
    verbatim/near-verbatim partial quotes (the common screenshot case) that the
    semantic pass alone misses when the quote is only part of a longer ayah."""
    q_words = tuple(normalize_english(query_text).split())
    # Word-level, not character-level: character-trigram matching (like the Arabic path
    # uses) turned out too permissive here — a long ayah has enough coincidental common
    # letter-sequences ("an", "ing", "at"...) to rack up high "coverage" against almost
    # any sufficiently long English sentence, garbage included. Requiring whole matching
    # WORDS in contiguous runs is a much stronger, less coincidental signal for English.
    if len(q_words) < 2:
        return []
    cache = _load_ayah_cache()
    q_word_set = frozenset(q_words)

    prelim = [(len(q_word_set & row["en_word_set"]), row) for row in cache]
    prelim.sort(key=lambda pair: pair[0], reverse=True)
    shortlist = [row for _, row in prelim[:ENGLISH_EXACT_PREFILTER_N]]

    scored = []
    for row in shortlist:
        sm = SequenceMatcher(None, q_words, row["en_words"], autojunk=False)
        matched = sum(block.size for block in sm.get_matching_blocks())
        score = min(matched / len(q_words), 1.0)
        scored.append((score, row))
    scored.sort(key=lambda pair: pair[0], reverse=True)

    return [
        _candidate(row, score=score, match_type="english", confidence=_tier_english(score))
        for score, row in scored[:top_k]
        if score >= ENGLISH_EXACT_FLOOR
    ]


def match_english(query_text: str, top_k: int = 5) -> list[dict]:
    """Runs both English passes. Exact (literal quote) hits are trusted over semantic
    (thematic) ones — a screenshot is almost always a literal excerpt, not a paraphrase
    — so semantic results only fill in remaining slots, and only for verses the exact
    pass didn't already find. Without this, a multi-ayah-spanning quote (e.g. a
    screenshot crossing a verse boundary) can score merely "low" on exact coverage for
    the two *correct* ayahs while an unrelated-but-thematically-close verse scores
    "high" on semantic similarity, burying the right answer under the wrong one.
    """
    exact = _match_english_exact(query_text, top_k)
    exact_verses = {c["verse_key"] for c in exact}
    semantic_fill = [c for c in _match_english_semantic(query_text, top_k) if c["verse_key"] not in exact_verses]

    exact_ranked = sorted(exact, key=lambda c: -c["score"])
    semantic_ranked = sorted(semantic_fill, key=lambda c: (_TIER_ORDER[c["confidence"]], -c["score"]))
    return (exact_ranked + semantic_ranked)[:top_k]


_TIER_ORDER = {"high": 0, "medium": 1, "low": 2}


def _dedupe_and_rank(candidates: list[dict]) -> list[dict]:
    """Keep the best entry per verse, preserving the priority order the caller already
    built (Arabic near-exact matches first, then match_english's own internal
    exact-quote-before-semantic-paraphrase ordering) — deliberately NOT re-sorted by
    tier here. A tier-based re-sort at this level silently undoes match_english's
    exact-over-semantic prioritization (a real regression this project hit once
    already: a correct-but-"low"-tier exact match got buried under an unrelated
    "high"-tier semantic one after this function re-sorted the merged list)."""
    best_by_verse: dict[str, dict] = {}
    order: list[str] = []
    for c in candidates:
        vk = c["verse_key"]
        if vk not in best_by_verse:
            order.append(vk)
            best_by_verse[vk] = c
        elif _TIER_ORDER[c["confidence"]] < _TIER_ORDER[best_by_verse[vk]["confidence"]]:
            best_by_verse[vk] = c  # better-tier data, but stays at its first-seen position
    return [best_by_verse[vk] for vk in order][:5]


def identify(text: str) -> dict:
    ratio = _arabic_char_ratio(text)
    candidates: list[dict] = []
    if ratio >= ARABIC_SCRIPT_FLOOR:
        candidates += match_arabic(text)
    if ratio < ARABIC_SCRIPT_CEILING:
        candidates += match_english(text)
    return {
        "detected_script": _script_label(ratio),
        "candidates": _dedupe_and_rank(candidates),
    }
