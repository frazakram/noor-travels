"""Local keyword retrieval when OpenAI embeddings are unavailable."""
import re
from typing import Any

from app.core.config import get_settings
from app.db import get_cursor, use_sqlite
from app.services.query_expansion import DUA_HINT, build_analysis


def _run_query(cur, sql: str, params: tuple | list = ()) -> None:
    """SQLite uses ? placeholders; Postgres/psycopg2 uses %s."""
    if use_sqlite():
        cur.execute(sql, params)
    else:
        cur.execute(sql.replace("?", "%s"), params)

STOP_WORDS = frozenset(
    """
    a an the and or but if then else when at by for with about against between into
    through during before after above below to from up down in out on off over under
    again further once here there all each few more most other some such no nor not
    only own same so than too very can will just don should now what which who whom
    whose why how where when is are was were be been being have has had do does did
    doing would could ought i you he she it we they me him her us them my your his
    its our their this that these those am of as
    """.split()
)

TOPIC_RULES: list[dict[str, Any]] = []  # legacy; routing lives in query_expansion.py

SURAH_ALIASES: dict[str, int] = {
    "ikhlas": 112,
    "ikhlaas": 112,
    "iklas": 112,
    "fatiha": 1,
    "fatihah": 1,
    "fateha": 1,
    "baqarah": 2,
    "bakarah": 2,
    "baqara": 2,
    "imran": 3,
    "imraan": 3,
    "aleimran": 3,
    "aliimran": 3,
    "aalimran": 3,
    "aleimraan": 3,
    "aliimraan": 3,
    "yasin": 36,
    "ya-sin": 36,
    "yaseen": 36,
    "mulk": 67,
    "kahf": 18,
    "nas": 114,
    "falaq": 113,
    "kafirun": 109,
    "kafiroon": 109,
    "muzzammil": 73,
    "muddaththir": 74,
    "rahman": 55,
    "waqiah": 56,
    "nisa": 4,
    "nisaa": 4,
    "maidah": 5,
    "anam": 6,
    "araf": 7,
    "anfal": 8,
    "taubah": 9,
    "tawbah": 9,
    "yunus": 10,
    "hud": 11,
    "yusuf": 12,
    "rad": 13,
    "ibrahim": 14,
    "hijr": 15,
    "nahl": 16,
    "isra": 17,
    "mujadila": 58,
    "hashr": 59,
    "mumtahina": 60,
    "saff": 61,
    "jumuah": 62,
    "munafiqun": 63,
    "taghabun": 64,
    "talaq": 65,
    "tahrim": 66,
    "mulk": 67,
    "qalam": 68,
    "haqqah": 69,
    "maarij": 70,
    "jinn": 72,
    "muzzammil": 73,
    "qiyamah": 75,
    "insan": 76,
    "mursalat": 77,
    "naba": 78,
    "naziat": 79,
    "abasa": 80,
    "takwir": 81,
    "infitar": 82,
    "mutaffifin": 83,
    "inshiqaq": 84,
    "buruj": 85,
    "tariq": 86,
    "ala": 87,
    "ghashiyah": 88,
    "fajr": 89,
    "balad": 90,
    "shams": 91,
    "layl": 92,
    "duha": 93,
    "sharh": 94,
    "tin": 95,
    "alaq": 96,
    "qadr": 97,
    "bayyinah": 98,
    "zalzalah": 99,
    "adiyat": 100,
    "qariah": 101,
    "takathur": 102,
    "asr": 103,
    "humazah": 104,
    "fil": 105,
    "quraysh": 106,
    "maun": 107,
    "kawthar": 108,
}

CHAPTER_SURAH_NUM = re.compile(
    r"(?:"
    r"(?:chapter|surah|sura)\s+(\d{1,3})\b"
    r"|(?:chapter|surah)\s+(\d{1,3})\s+of\s+(?:the\s+)?quran"
    r"|(?:the\s+)?quran\s+(?:chapter|surah)\s+(\d{1,3})\b"
    r"|what(?:'s|s| is)\s+(?:the\s+)?(?:chapter|surah)\s+(\d{1,3})\b"
    r"|(\d{1,3})\s+of\s+(?:the\s+)?quran\b"
    r")",
    re.I,
)

VERSE_N_OF_CHAPTER = re.compile(
    r"(?:verse|ayah|ayat)\s+(?:number\s+)?(\d{1,3})\s+(?:of|in|from)\s+(?:chapter|surah|sura)\s+(\d{1,3})",
    re.I,
)
CHAPTER_VERSE_N = re.compile(
    r"(?:chapter|surah|sura)\s+(\d{1,3})\s+(?:verse|ayah|ayat)\s+(?:number\s+)?(\d{1,3})",
    re.I,
)
COLON_VERSE_REF = re.compile(r"\b(\d{1,3})\s*:\s*(\d{1,3})\b")
COLON_VERSE_RANGE = re.compile(r"\b(\d{1,3})\s*:\s*(\d{1,3})\s*[-–]\s*(\d{1,3})\b")
VERSE_RANGE_OF_CHAPTER = re.compile(
    r"(?:verses?|ayahs?|ayat)\s+(?:from\s+)?(\d{1,3})\s+to\s+(\d{1,3})\s+(?:of|in|from)\s+(?:chapter|surah|sura)\s+(\d{1,3})",
    re.I,
)
CHAPTER_VERSE_RANGE = re.compile(
    r"(?:chapter|surah|sura)\s+(\d{1,3})\s+(?:verses?|ayahs?|ayat)\s+(\d{1,3})\s+to\s+(\d{1,3})",
    re.I,
)
CHAPTER_VERSE_DASH = re.compile(
    r"(?:chapter|surah|sura)\s+(\d{1,3})\s+(?:verses?|ayahs?|ayat)\s+(\d{1,3})\s*[-–]\s*(\d{1,3})",
    re.I,
)

MAX_VERSE_RANGE = 20

QURAN_CONTEXT = re.compile(r"\b(quran|surah|sura|chapter|ayah|ayat|verse)\b", re.I)
PERIOD_HINT = re.compile(
    r"time\s*period|when\s+(?:was|were)|revelation|revealed|medinan|meccan|makki|madani|era|hijrah|hijra",
    re.I,
)

SEARCH_STOP = STOP_WORDS | frozenset(
    """
    quran kuran chapter surah sura verse ayah ayat whats whats the this that
    time period when reveal revealed revelation era tell give show
    """.split()
)

LONG_SURAH_AYAH_LIMIT = 6

SUMMARY_HINTS = re.compile(
    r"summ?a?r[iy]?[sz]e?|summary|overview|explain|about|meaning|tell me|what is|describe",
    re.I,
)


def _normalize_name(name: str) -> str:
    n = name.lower().strip()
    for _ in range(2):
        n = re.sub(r"^(?:al|aal|ale|ar|as|at|ad)[\s'-]+", "", n)
    return re.sub(r"[^a-z0-9]", "", n)


def _has_surah_context(question: str) -> bool:
    return bool(
        QURAN_CONTEXT.search(question)
        or SUMMARY_HINTS.search(question)
        or PERIOD_HINT.search(question)
    )


def detect_verse_range(question: str) -> tuple[int, int, int] | None:
    """Return (surah_number, start_ayah, end_ayah) for a verse range request."""
    q = question.strip()

    m = VERSE_RANGE_OF_CHAPTER.search(q)
    if m:
        start, end, surah = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if start > end:
            start, end = end, start
        if 1 <= surah <= 114 and 1 <= start <= 286 and 1 <= end <= 286 and (end - start + 1) <= MAX_VERSE_RANGE:
            return surah, start, end

    m = CHAPTER_VERSE_RANGE.search(q)
    if m:
        surah, start, end = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if start > end:
            start, end = end, start
        if 1 <= surah <= 114 and 1 <= start <= 286 and 1 <= end <= 286 and (end - start + 1) <= MAX_VERSE_RANGE:
            return surah, start, end

    m = CHAPTER_VERSE_DASH.search(q)
    if m:
        surah, start, end = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if start > end:
            start, end = end, start
        if 1 <= surah <= 114 and 1 <= start <= 286 and 1 <= end <= 286 and (end - start + 1) <= MAX_VERSE_RANGE:
            return surah, start, end

    m = COLON_VERSE_RANGE.search(q)
    if m:
        surah, start, end = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if start > end:
            start, end = end, start
        if 1 <= surah <= 114 and 1 <= start <= 286 and 1 <= end <= 286 and (end - start + 1) <= MAX_VERSE_RANGE:
            return surah, start, end

    return None


def is_verse_query(question: str) -> bool:
    return detect_verse_range(question) is not None or detect_verse_reference(question) is not None


def detect_verse_reference(question: str) -> tuple[int, int] | None:
    """Return (surah_number, ayah_number) when a specific verse is requested."""
    if detect_verse_range(question):
        return None

    q = question.strip()

    m = VERSE_N_OF_CHAPTER.search(q)
    if m:
        ayah, surah = int(m.group(1)), int(m.group(2))
        if 1 <= surah <= 114 and 1 <= ayah <= 286:
            return surah, ayah

    m = CHAPTER_VERSE_N.search(q)
    if m:
        surah, ayah = int(m.group(1)), int(m.group(2))
        if 1 <= surah <= 114 and 1 <= ayah <= 286:
            return surah, ayah

    m = COLON_VERSE_REF.search(q)
    if m:
        surah, ayah = int(m.group(1)), int(m.group(2))
        if 1 <= surah <= 114 and 1 <= ayah <= 286:
            return surah, ayah

    return None


def detect_surah_number(question: str) -> int | None:
    q = question.lower()

    m = CHAPTER_SURAH_NUM.search(q)
    if m:
        num = next(int(g) for g in m.groups() if g)
        if 1 <= num <= 114:
            return num

    cleaned = re.sub(
        r"summ?a?r[iy]?[sz]e?|summary|overview|for me|please|tell me|about|explain|"
        r"meaning|what is|what's|whats|describe|the|surah|sura|surat|chapter|of|and",
        " ",
        q,
    )
    cleaned = re.sub(r"[^\w\s'-]", " ", cleaned)

    tokens = [
        t.strip("-'")
        for t in cleaned.split()
        if t.strip("-'") and t.strip("-'") not in SEARCH_STOP
    ]

    for token in tokens:
        if token in SURAH_ALIASES:
            return SURAH_ALIASES[token]
        norm = _normalize_name(token)
        for alias, num in SURAH_ALIASES.items():
            if _normalize_name(alias) == norm:
                return num

    for i in range(len(tokens)):
        for j in range(i + 1, min(i + 4, len(tokens)) + 1):
            joined = _normalize_name("".join(tokens[i:j]))
            if joined in SURAH_ALIASES:
                return SURAH_ALIASES[joined]

    if not _has_surah_context(question):
        return None

    norm_q = _normalize_name("".join(tokens))
    if not norm_q:
        return None

    with get_cursor() as cur:
        cur.execute("SELECT number, name_en, name_en_translation FROM surahs")
        rows = cur.fetchall()

    best_num: int | None = None
    best_len = 0
    for row in rows:
        if use_sqlite():
            num, name_en, name_tr = row
        else:
            num, name_en, name_tr = row["number"], row["name_en"], row["name_en_translation"]
        for name in (name_en, name_tr or ""):
            norm_name = _normalize_name(name)
            if len(norm_name) < 5:
                continue
            if norm_name == norm_q:
                return int(num)
            if norm_name in norm_q and len(norm_name) >= 6:
                if len(norm_name) > best_len:
                    best_num, best_len = int(num), len(norm_name)
            for token in tokens:
                if _normalize_name(token) == norm_name:
                    return int(num)
    return best_num


def analyze_keyword_query(question: str, lang: str = "en") -> dict[str, Any]:
    q = question.lower().strip()
    verse_range = detect_verse_range(question)
    if verse_range:
        surah_number, start_ayah, end_ayah = verse_range
        verse_keys = [f"{surah_number}:{n}" for n in range(start_ayah, end_ayah + 1)]
        return {
            "search_terms": [],
            "source_filter": ["quran", "tafsir"],
            "verse_keys": verse_keys,
            "surah_number": surah_number,
            "ayah_start": start_ayah,
            "ayah_end": end_ayah,
            "topic": "verse_range_lookup",
            "detected_language": lang,
            "intent": "verse_range_lookup",
            "wants_period": False,
            "standalone_question": question,
        }

    verse_ref = detect_verse_reference(question)
    if verse_ref:
        surah_number, ayah_number = verse_ref
        return {
            "search_terms": [],
            "source_filter": ["quran", "tafsir"],
            "verse_keys": [f"{surah_number}:{ayah_number}"],
            "surah_number": surah_number,
            "ayah_number": ayah_number,
            "topic": "verse_lookup",
            "detected_language": lang,
            "intent": "verse_lookup",
            "wants_period": False,
            "standalone_question": question,
        }

    surah_number = detect_surah_number(question)
    if surah_number:
        return {
            "search_terms": [],
            "source_filter": ["quran", "tafsir"],
            "verse_keys": [],
            "surah_number": surah_number,
            "topic": "surah_summary",
            "detected_language": lang,
            "intent": "surah_summary",
            "wants_period": bool(PERIOD_HINT.search(question)),
            "standalone_question": question,
        }

    terms = extract_search_terms(question)
    expanded = build_analysis(question, lang, terms)
    return {
        **expanded,
        "verse_keys": expanded.get("verse_keys") or [],
        "topic": "",
        "intent": expanded.get("intent", "search"),
    }


def extract_search_terms(text: str, min_len: int = 3) -> list[str]:
    raw = re.findall(r"[a-zA-Z\u0600-\u06FF\u0900-\u097F]{2,}", text.lower())
    terms = []
    for t in raw:
        if t in SEARCH_STOP or len(t) < min_len:
            continue
        terms.append(t)
    return list(dict.fromkeys(terms))


def _score_text(text: str, terms: list[str]) -> float:
    if not terms:
        return 0.0
    lower = text.lower()
    hits = sum(1 for t in terms if t in lower)
    if hits == 0:
        return 0.0
    # Reward matching multiple distinct terms, not just one common word
    ratio = hits / len(terms)
    bonus = 0.15 * (hits - 1) if hits > 1 else 0.0
    return min(1.0, ratio + bonus)


def _fetch_hadith_by_refs(refs: list[str]) -> list[dict]:
    if not refs:
        return []
    results = []
    with get_cursor() as cur:
        for ref in refs:
            if use_sqlite():
                cur.execute(
                    "SELECT id, reference, chapter_en, arabic, english FROM hadiths WHERE reference = ?",
                    (ref,),
                )
            else:
                cur.execute(
                    "SELECT id, reference, chapter_en, arabic, english FROM hadiths WHERE reference = %s",
                    (ref,),
                )
            row = cur.fetchone()
            if not row:
                continue
            if use_sqlite():
                hid, reference, ch, ar, en = row
            else:
                hid = row["id"]
                reference, ch, ar, en = row["reference"], row["chapter_en"], row["arabic"], row["english"]
            content = f"{reference}. Chapter: {ch}. English: {en[:2000]}."
            results.append(
                {
                    "source_type": "hadith",
                    "source_ref": reference,
                    "content": content,
                    "metadata": {"hadith_id": hid, "curated": True},
                    "similarity": 0.96,
                }
            )
    return results


def _fetch_ayah_chunks(verse_keys: list[str]) -> list[dict]:
    if not verse_keys:
        return []
    results = []
    with get_cursor() as cur:
        for vk in verse_keys:
            if use_sqlite():
                cur.execute(
                    """
                    SELECT verse_key, arabic, transliteration, translation_en, translation_ur
                    FROM ayahs WHERE verse_key = ?
                    """,
                    (vk,),
                )
            else:
                cur.execute(
                    """
                    SELECT verse_key, arabic, transliteration, translation_en, translation_ur
                    FROM ayahs WHERE verse_key = %s
                    """,
                    (vk,),
                )
            row = cur.fetchone()
            if not row:
                continue
            if use_sqlite():
                vk, ar, tr, en, ur = row
            else:
                vk, ar, tr, en, ur = (
                    row["verse_key"],
                    row["arabic"],
                    row["transliteration"],
                    row["translation_en"],
                    row["translation_ur"],
                )
            content = f"Quran {vk}. Arabic: {ar}. English: {en}. Urdu: {ur}."
            results.append(
                {
                    "source_type": "quran",
                    "source_ref": f"Quran {vk}",
                    "content": content,
                    "metadata": {"verse_key": vk, "curated": True},
                    "similarity": 0.95,
                }
            )
    return results


def _search_ayahs(terms: list[str], limit: int) -> list[dict]:
    if not terms:
        return []
    clauses = []
    params: list[Any] = []
    for t in terms[:8]:
        clauses.append(
            "(translation_en LIKE ? OR translation_ur LIKE ? OR transliteration LIKE ?)"
        )
        pat = f"%{t}%"
        params.extend([pat, pat, pat])

    where = " OR ".join(clauses)
    sql = f"""
        SELECT verse_key, arabic, transliteration, translation_en, translation_ur
        FROM ayahs WHERE {where} LIMIT ?
    """
    params.append(limit * 4)

    results = []
    with get_cursor() as cur:
        _run_query(cur, sql, params)
        rows = cur.fetchall()

    for row in rows:
        if use_sqlite():
            vk, ar, tr, en, ur = row
        else:
            vk, ar, tr, en, ur = (
                row["verse_key"],
                row["arabic"],
                row["transliteration"],
                row["translation_en"],
                row["translation_ur"],
            )
        content = f"Quran {vk}. Arabic: {ar}. English: {en}. Urdu: {ur}."
        score = _score_text(content, terms)
        if score < 0.2:
            continue
        results.append(
            {
                "source_type": "quran",
                "source_ref": f"Quran {vk}",
                "content": content,
                "metadata": {"verse_key": vk},
                "similarity": score,
            }
        )

    results.sort(key=lambda x: x["similarity"], reverse=True)
    return results[:limit]


def _search_hadiths(terms: list[str], limit: int) -> list[dict]:
    if not terms:
        return []
    clauses = []
    params: list[Any] = []
    for t in terms[:6]:
        clauses.append("(english LIKE ? OR chapter_en LIKE ?)")
        pat = f"%{t}%"
        params.extend([pat, pat])

    where = " OR ".join(clauses)
    sql = f"SELECT id, reference, chapter_en, arabic, english FROM hadiths WHERE {where} LIMIT ?"
    params.append(limit * 3)

    results = []
    with get_cursor() as cur:
        _run_query(cur, sql, params)
        rows = cur.fetchall()

    for row in rows:
        if use_sqlite():
            hid, ref, ch, ar, en = row
        else:
            hid, ref, ch, ar, en = row["id"], row["reference"], row["chapter_en"], row["arabic"], row["english"]
        content = f"{ref}. Chapter: {ch}. English: {en[:1500]}."
        score = _score_text(content, terms)
        if score < 0.35:
            continue
        results.append(
            {
                "source_type": "hadith",
                "source_ref": ref,
                "content": content,
                "metadata": {"hadith_id": hid},
                "similarity": score,
            }
        )

    results.sort(key=lambda x: x["similarity"], reverse=True)
    return results[:limit]


def _search_duas(terms: list[str], limit: int, dua_categories: list[str] | None = None) -> list[dict]:
    if not terms:
        return []
    clauses = []
    params: list[Any] = []
    for t in terms[:6]:
        clauses.append("(title_en LIKE ? OR translation_en LIKE ? OR translation_ur LIKE ?)")
        pat = f"%{t}%"
        params.extend([pat, pat, pat])

    where = " OR ".join(clauses)
    category_sql = ""
    if dua_categories:
        placeholders = ", ".join("?" * len(dua_categories))
        category_sql = f" AND category IN ({placeholders})"
        params.extend(dua_categories)

    sql = """
        SELECT id, title_en, arabic, transliteration, translation_en, translation_ur, source, category
        FROM duas WHERE (""" + where + ")" + category_sql + " LIMIT ?"
    params.append(limit * 2)

    results = []
    with get_cursor() as cur:
        _run_query(cur, sql, params)
        rows = cur.fetchall()

    for row in rows:
        if use_sqlite():
            did, title, ar, tr, en, ur, src, row_cat = row
        else:
            did = row["id"]
            title, ar, tr, en, ur, src, row_cat = (
                row["title_en"],
                row["arabic"],
                row["transliteration"],
                row["translation_en"],
                row["translation_ur"],
                row["source"],
                row["category"],
            )
        content = (
            f"Dua {did}: {title}. Arabic: {ar}. Transliteration: {tr}. "
            f"English: {en}. Urdu: {ur}. Source: {src}"
        )
        score = _score_text(content, terms)
        if score < 0.35:
            continue
        results.append(
            {
                "source_type": "dua",
                "source_ref": f"Dua {did}",
                "content": content,
                "metadata": {"dua_id": did, "category": row_cat},
                "similarity": score,
            }
        )

    results.sort(key=lambda x: x["similarity"], reverse=True)
    return results[:limit]


def _search_tafsir(terms: list[str], limit: int) -> list[dict]:
    if not terms:
        return []
    clauses = []
    params: list[Any] = []
    for t in terms[:5]:
        clauses.append("text LIKE ?")
        params.append(f"%{t}%")

    where = " OR ".join(clauses)
    sql = f"""
        SELECT verse_key, source, text FROM tafsir
        WHERE source IN ('ibn_kathir_en', 'maududi_ur') AND ({where})
        LIMIT ?
    """
    params.append(limit * 2)

    results = []
    with get_cursor() as cur:
        _run_query(cur, sql, params)
        rows = cur.fetchall()

    for row in rows:
        if use_sqlite():
            vk, src, txt = row
        else:
            vk, src, txt = row["verse_key"], row["source"], row["text"]
        content = f"Tafsir {src} {vk}: {txt[:2000]}"
        score = _score_text(content, terms)
        if score < 0.25:
            continue
        results.append(
            {
                "source_type": "tafsir",
                "source_ref": f"Tafsir {vk} ({src})",
                "content": content,
                "metadata": {"verse_key": vk, "tafsir_source": src},
                "similarity": score,
            }
        )

    results.sort(key=lambda x: x["similarity"], reverse=True)
    return results[:limit]


def _fetch_surah_summary_chunks(surah_number: int) -> list[dict]:
    chunks: list[dict] = []
    with get_cursor() as cur:
        _run_query(
            cur,
            """
            SELECT verse_key, arabic, transliteration, translation_en, translation_ur, ayah_number
            FROM ayahs WHERE surah_number = ? ORDER BY ayah_number
            """,
            (surah_number,),
        )
        ayah_rows = cur.fetchall()
        ayah_count = len(ayah_rows)
        show_nums = set(_representative_ayah_numbers(ayah_count))
        tafsir_anchors = _tafsir_anchor_ayahs(ayah_count)

    tafsir_en, tafsir_ur = _fetch_tafsir_at_ayahs(surah_number, tafsir_anchors)

    for row in ayah_rows:
        if use_sqlite():
            vk, ar, tr, en, ur, num = row
        else:
            vk, ar, tr, en, ur = (
                row["verse_key"],
                row["arabic"],
                row["transliteration"],
                row["translation_en"],
                row["translation_ur"],
            )
            num = row["ayah_number"]
        if num not in show_nums:
            continue
        content = f"Quran {vk}. Arabic: {ar}. English: {en}. Urdu: {ur}."
        chunks.append(
            {
                "source_type": "quran",
                "source_ref": f"Quran {vk}",
                "content": content,
                "metadata": {"verse_key": vk, "surah_summary": True},
                "similarity": 0.99,
            }
        )

    for anchor in tafsir_anchors:
        en_txt = tafsir_en.get(anchor)
        if en_txt:
            chunks.append(
                {
                    "source_type": "tafsir",
                    "source_ref": f"Tafsir {surah_number}:{anchor} (ibn_kathir_en)",
                    "content": f"Tafsir ibn_kathir_en {surah_number}:{anchor}: {en_txt[:2500]}",
                    "metadata": {
                        "verse_key": f"{surah_number}:{anchor}",
                        "tafsir_source": "ibn_kathir_en",
                        "surah_summary": True,
                    },
                    "similarity": 0.98 - (anchor * 0.0001),
                }
            )
        ur_txt = tafsir_ur.get(anchor)
        if ur_txt:
            chunks.append(
                {
                    "source_type": "tafsir",
                    "source_ref": f"Tafsir {surah_number}:{anchor} (maududi_ur)",
                    "content": f"Tafsir maududi_ur {surah_number}:{anchor}: {ur_txt[:1500]}",
                    "metadata": {
                        "verse_key": f"{surah_number}:{anchor}",
                        "tafsir_source": "maududi_ur",
                        "surah_summary": True,
                    },
                    "similarity": 0.97 - (anchor * 0.0001),
                }
            )

    return chunks


def _fetch_verse_range_chunks(surah_number: int, start_ayah: int, end_ayah: int) -> list[dict]:
    verse_keys = [f"{surah_number}:{n}" for n in range(start_ayah, end_ayah + 1)]
    return _fetch_ayah_chunks(verse_keys)


def _fetch_verse_lookup_chunks(verse_key: str) -> list[dict]:
    chunks = _fetch_ayah_chunks([verse_key])
    surah_num, ayah_num = verse_key.split(":")
    with get_cursor() as cur:
        for source in ("ibn_kathir_en", "maududi_ur"):
            _run_query(
                cur,
                "SELECT text FROM tafsir WHERE verse_key = ? AND source = ?",
                (verse_key, source),
            )
            row = cur.fetchone()
            if not row:
                continue
            txt = row[0] if use_sqlite() else row["text"]
            if not txt or len(txt.strip()) < 20:
                continue
            chunks.append(
                {
                    "source_type": "tafsir",
                    "source_ref": f"Tafsir {verse_key} ({source})",
                    "content": f"Tafsir {source} {verse_key}: {txt[:2000]}",
                    "metadata": {"verse_key": verse_key, "tafsir_source": source, "verse_lookup": True},
                    "similarity": 0.98,
                }
            )
    return chunks


def keyword_retrieve_smart(question: str, lang: str = "en") -> tuple[list[dict], dict[str, Any]]:
    analysis = analyze_keyword_query(question, lang)

    if analysis.get("intent") == "verse_range_lookup" and analysis.get("verse_keys"):
        return (
            _fetch_verse_range_chunks(
                analysis["surah_number"],
                analysis["ayah_start"],
                analysis["ayah_end"],
            ),
            analysis,
        )

    if analysis.get("intent") == "verse_lookup" and analysis.get("verse_keys"):
        return _fetch_verse_lookup_chunks(analysis["verse_keys"][0]), analysis

    if analysis.get("intent") == "surah_summary" and analysis.get("surah_number"):
        return _fetch_surah_summary_chunks(analysis["surah_number"]), analysis

    terms = analysis["search_terms"]
    source_filter = analysis["source_filter"]
    dua_categories = analysis.get("dua_categories") or []
    settings = get_settings()
    per_source = max(6, settings.rag_retrieval_k // max(1, len(source_filter)))

    candidates: list[dict] = []
    candidates.extend(_fetch_ayah_chunks(analysis.get("verse_keys") or []))
    candidates.extend(_fetch_hadith_by_refs(analysis.get("hadith_refs") or []))

    if "quran" in source_filter:
        candidates.extend(_search_ayahs(terms, per_source))
    if "hadith" in source_filter:
        candidates.extend(_search_hadiths(terms, per_source))
    if "dua" in source_filter:
        candidates.extend(_search_duas(terms, per_source, dua_categories or None))
    if "tafsir" in source_filter:
        candidates.extend(_search_tafsir(terms, per_source // 2))

    seen: dict[str, dict] = {}
    for c in candidates:
        ref = c["source_ref"]
        if ref not in seen or c["similarity"] > seen[ref]["similarity"]:
            seen[ref] = c

    ranked = sorted(seen.values(), key=lambda x: x["similarity"], reverse=True)
    has_curated = any(c.get("metadata", {}).get("curated") for c in ranked)
    if has_curated:
        curated = [c for c in ranked if c.get("metadata", {}).get("curated")]
        other = [c for c in ranked if not c.get("metadata", {}).get("curated") and c["similarity"] >= 0.3]
        ranked = curated + other
    else:
        ranked = [c for c in ranked if c["similarity"] >= 0.3]

    return ranked[: settings.rag_retrieval_k], analysis


def _curated_intro(themes: list[str], lang: str, question: str) -> str:
    is_dua = bool(DUA_HINT.search(question))
    if is_dua and "study" in themes:
        return {
            "en": (
                "We don't have a dedicated exam dua in our collection yet. "
                "Related Quranic guidance on knowledge:"
            ),
            "ur": (
                "امتحان کی مخصوص دعا ہمارے مجموعے میں نہیں ہے۔ "
                "علم کے بارے میں قرآنی رہنمائی:"
            ),
            "hi": (
                "परीक्षा की विशेष दुआ हमारे संग्रह में नहीं है। "
                "ज्ञान पर कुरान से संबंधित मार्गदर्शन:"
            ),
        }.get(lang, "Related Quranic guidance on knowledge:")
    if "purpose" in themes:
        return {
            "en": "According to the Quran, the purpose of human life includes:",
            "ur": "قرآن کی روشنی میں انسان کی تخلیق کا مقصد:",
            "hi": "कुरान के अनुसार इंसान की रचना का उद्देश्य:",
        }.get(lang, "According to the Quran:")
    return {
        "en": "Relevant guidance from the Quran:",
        "ur": "قرآن سے متعلقہ رہنمائی:",
        "hi": "कुरान से संबंधित मार्गदर्शन:",
    }.get(lang, "Relevant guidance from the Quran:")


def format_curated_answer(chunks: list[dict], lang: str, analysis: dict[str, Any] | None = None) -> str | None:
    """Short summary when curated Quran verses were topic-matched."""
    curated = [c for c in chunks if c.get("metadata", {}).get("curated")]
    if not curated:
        return None

    themes = (analysis or {}).get("themes") or []
    question = (analysis or {}).get("standalone_question", "")
    from app.services.query_expansion import get_theme_summary

    themed = get_theme_summary(themes, lang)
    if themed:
        return themed
    return _curated_intro(themes, lang, question)


def _is_mostly_latin(text: str) -> bool:
    letters = [c for c in text if c.isalpha()]
    if not letters:
        return False
    latin = sum(1 for c in letters if ord(c) < 128)
    return latin / len(letters) >= 0.72


def _tafsir_anchor_ayahs(ayah_count: int) -> list[int]:
    if ayah_count <= 1:
        return [1]
    anchors = {1, ayah_count}
    if ayah_count >= 12:
        anchors.add(ayah_count // 2)
    if ayah_count >= 24:
        anchors.add((2 * ayah_count) // 3)
    return sorted(anchors)


def _representative_ayah_numbers(ayah_count: int) -> list[int]:
    if ayah_count <= 8:
        return list(range(1, ayah_count + 1))
    picks = [1, 2, 3, ayah_count // 2, ayah_count - 1, ayah_count]
    return sorted({n for n in picks if 1 <= n <= ayah_count})


def _polish_teaching_bullet(text: str) -> str | None:
    bullet = re.sub(r"\s+", " ", text).strip().rstrip(",")
    if len(bullet) < 25 or len(bullet) > 220:
        return None
    if re.search(r"\b(because|then|and|the|of|who|which|here|because)$", bullet, re.I):
        return None
    if not bullet.endswith(".") and "," in bullet:
        return None
    if re.match(r'^Say,', bullet):
        return None
    if bullet[0].islower():
        bullet = bullet[0].upper() + bullet[1:]
    return bullet


def _extract_ibn_kathir_teaching_bullets(text: str, max_bullets: int = 6) -> list[str]:
    """Pull section themes and 'meaning' explanations from Ibn Kathir English tafsir."""
    flat = re.sub(r"\s+", " ", text).strip()
    bullets: list[str] = []
    seen: set[str] = set()

    for m in re.finditer(
        r"([A-Z][A-Za-z'',\- ]{18,115}?)"
        r"(?:\s+In rejection|\s+Then, Allah|\s+Allah says|\s+Concerning Allah)",
        flat,
    ):
        heading = m.group(1).strip().rstrip(",")
        if heading.startswith("In the Name"):
            continue
        polished = _polish_teaching_bullet(heading)
        if not polished:
            continue
        key = polished.lower()[:55]
        if key not in seen:
            seen.add(key)
            bullets.append(polished)

    theme_terms = (
        "day of judgement",
        "judgment",
        "hereafter",
        "resurrect",
        "warning",
        "proof",
        "paradise",
        "hell",
        "righteous",
        "deny",
        "disbelieve",
        "reward",
        "punishment",
        "taqwa",
    )
    scored: list[tuple[int, str]] = []
    for m in re.finditer(
        r"meaning,\s+([^()]{30,220}?)\.",
        flat,
        re.I,
    ):
        sent = re.sub(r"\s+", " ", m.group(1)).strip().strip("'\"")
        if not _is_mostly_latin(sent):
            continue
        if sent.lower().startswith("an established, firm and peaceful resting"):
            continue
        if sent.lower().startswith("he made them as pegs"):
            continue
        score = sum(1 for t in theme_terms if t in sent.lower())
        if score or len(sent) > 60:
            polished = _polish_teaching_bullet(sent if sent.endswith(".") else sent + ".")
            if polished:
                scored.append((score, polished))

    scored.sort(key=lambda x: (-x[0], -len(x[1])))
    for _score, sent in scored:
        key = sent.lower()[:55]
        if key not in seen:
            seen.add(key)
            bullets.append(sent)

    for m in re.finditer(r"(This is a severe threat[^.]+\.)", flat):
        polished = _polish_teaching_bullet(m.group(1).strip())
        if not polished:
            continue
        key = polished.lower()[:55]
        if key not in seen:
            seen.add(key)
            bullets.append(polished)

    return bullets[:max_bullets]


def _fetch_tafsir_at_ayahs(surah_number: int, ayah_numbers: list[int]) -> tuple[dict[int, str], dict[int, str]]:
    en_map: dict[int, str] = {}
    ur_map: dict[int, str] = {}
    with get_cursor() as cur:
        for num in ayah_numbers:
            vk = f"{surah_number}:{num}"
            _run_query(
                cur,
                "SELECT text FROM tafsir WHERE verse_key = ? AND source = 'ibn_kathir_en'",
                (vk,),
            )
            row = cur.fetchone()
            if row:
                en_map[num] = row[0] if use_sqlite() else row["text"]
            _run_query(
                cur,
                "SELECT text FROM tafsir WHERE verse_key = ? AND source = 'maududi_ur'",
                (vk,),
            )
            row = cur.fetchone()
            if row:
                txt = (row[0] if use_sqlite() else row["text"]).strip()
                if len(txt) > 20:
                    ur_map[num] = txt
    return en_map, ur_map


def _build_surah_teaching_bullets(
    ayahs: list,
    lang: str,
    tafsir_en: dict[int, str],
    tafsir_ur: dict[int, str],
) -> list[str]:
    bullets: list[str] = []
    seen: set[str] = set()

    if lang == "ur" and tafsir_ur:
        for txt in tafsir_ur.values():
            for sent in re.split(r"(?<=[۔!?])\s+", txt):
                sent = sent.strip()
                if 25 <= len(sent) <= 220 and sent not in seen:
                    seen.add(sent)
                    bullets.append(sent)

    if tafsir_en:
        per_anchor = [
            _extract_ibn_kathir_teaching_bullets(tafsir_en[anchor], max_bullets=4)
            for anchor in sorted(tafsir_en.keys())
        ]
        per_anchor = [g for g in per_anchor if g]
        idx = 0
        while len(bullets) < 5 and any(idx < len(g) for g in per_anchor):
            for group in per_anchor:
                if idx < len(group):
                    b = group[idx]
                    key = b.lower()[:55]
                    if key not in seen:
                        seen.add(key)
                        bullets.append(b)
            idx += 1

    if len(bullets) < 3:
        indices = _representative_ayah_numbers(len(ayahs))
        use_ur = lang == "ur"
        use_hi = lang == "hi"
        for row in ayahs:
            if use_sqlite():
                num, _ar, en, ur, _tr = row
            else:
                num = row["ayah_number"]
                en, ur = row["translation_en"], row["translation_ur"]
            if num not in indices:
                continue
            trans = ur if use_ur and ur else en
            if use_hi:
                trans = en
            if trans and len(trans) > 12:
                key = trans.lower()[:55]
                if key not in seen:
                    seen.add(key)
                    bullets.append(trans.strip())

    return bullets[:5]


def _period_note(revelation_type: str, tafsir_text: str, lang: str) -> str:
    if lang == "ur":
        if revelation_type == "Medinan":
            base = (
                "نزولی دور: مدنی — یہ سورہ ہجرتِ مدینہ کے بعد نازل ہوئی۔ "
                "اس میں عموماً مسلمانوں کی جماعت، شریعت، اور اہلِ کتاب سے تعلقات پر گفتگو ہے۔"
            )
        else:
            base = (
                "نزولی دور: مکی — یہ سورہ ہجرت سے پہلے نازل ہوئی۔ "
                "اس میں عموماً ایمان، توحید، اور آخرت پر زور ہے۔"
            )
    elif lang == "hi":
        if revelation_type == "Medinan":
            base = (
                "अवतरण काल: मदनी — हिजरत के बाद नाज़िल। "
                "मुस्लिम समुदाय, शरीयत और अहले किताब से संबंधित विषय।"
            )
        else:
            base = (
                "अवतरण काल: मक्की — हिजरत से पहले नाज़िल। "
                "ईमान, तौहीद और आख़िरत पर अधिक ज़ोर।"
            )
    else:
        if revelation_type == "Medinan":
            base = (
                "Revelation period: Medinan — revealed after the Hijrah to Madinah. "
                "These surahs often address the Muslim community, law, and relations with People of the Book."
            )
        else:
            base = (
                "Revelation period: Meccan — revealed before the Hijrah to Makkah. "
                "These surahs often focus on faith (iman), monotheism (tawheed), and the Hereafter."
            )

    if tafsir_text:
        for sent in re.split(r"(?<=[.!?])\s+", tafsir_text[:4000]):
            if re.search(r"reveal|medinan|meccan|hijrah|hijra|emigration|madinah|makkah", sent, re.I):
                snippet = re.sub(r"\s+", " ", sent).strip()
                if 40 < len(snippet) < 400:
                    base += f"\n• {snippet}"
                    break
    return base


def format_verse_range_answer(surah_number: int, start_ayah: int, end_ayah: int, lang: str) -> str:
    with get_cursor() as cur:
        _run_query(
            cur,
            "SELECT name_en, name_en_translation FROM surahs WHERE number = ?",
            (surah_number,),
        )
        surah = cur.fetchone()
        _run_query(
            cur,
            """
            SELECT ayah_number, arabic, translation_en, translation_ur, transliteration
            FROM ayahs
            WHERE surah_number = ? AND ayah_number BETWEEN ? AND ?
            ORDER BY ayah_number
            """,
            (surah_number, start_ayah, end_ayah),
        )
        rows = cur.fetchall()

    if not surah or not rows:
        return f"Verses {surah_number}:{start_ayah}-{end_ayah} not found."

    if use_sqlite():
        name_en, name_tr = surah
    else:
        name_en = surah["name_en"]
        name_tr = surah["name_en_translation"]

    if lang == "ur":
        header = f"سورہ {name_en} ({surah_number}:{start_ayah}-{end_ayah})"
        trans_label = "ترجمہ:"
        translit_label = "تلفظ:"
    elif lang == "hi":
        header = f"सूरह {name_en} ({surah_number}:{start_ayah}-{end_ayah})"
        trans_label = "अनुवाद:"
        translit_label = "लिप्यंतरण:"
    else:
        header = f"Quran {surah_number}:{start_ayah}-{end_ayah} — {name_en}"
        if name_tr:
            header += f" ({name_tr})"
        trans_label = "Translation:"
        translit_label = "Transliteration:"

    lines = [header, ""]
    for row in rows:
        if use_sqlite():
            num, arabic, trans_en, trans_ur, translit = row
        else:
            num = row["ayah_number"]
            arabic = row["arabic"]
            trans_en = row["translation_en"]
            trans_ur = row["translation_ur"]
            translit = row["transliteration"]
        trans = (trans_ur or trans_en) if lang == "ur" else trans_en
        lines.append(f"{surah_number}:{num}")
        lines.append(arabic)
        if translit:
            lines.append(f"{translit_label} {translit}")
        if trans:
            lines.append(f"{trans_label} {trans}")
        lines.append("")

    return "\n".join(lines).strip()


def format_verse_answer(verse_key: str, lang: str) -> str:
    surah_number, ayah_number = (int(x) for x in verse_key.split(":"))
    with get_cursor() as cur:
        _run_query(
            cur,
            "SELECT name_en, name_en_translation FROM surahs WHERE number = ?",
            (surah_number,),
        )
        surah = cur.fetchone()
        _run_query(
            cur,
            """
            SELECT arabic, translation_en, translation_ur, transliteration
            FROM ayahs WHERE surah_number = ? AND ayah_number = ?
            """,
            (surah_number, ayah_number),
        )
        ayah = cur.fetchone()

    if not surah or not ayah:
        return f"Verse {verse_key} not found."

    if use_sqlite():
        name_en, name_tr = surah
        arabic, trans_en, trans_ur, translit = ayah
    else:
        name_en = surah["name_en"]
        name_tr = surah["name_en_translation"]
        arabic = ayah["arabic"]
        trans_en = ayah["translation_en"]
        trans_ur = ayah["translation_ur"]
        translit = ayah["transliteration"]

    if lang == "ur":
        header = f"سورہ {name_en} ({surah_number}:{ayah_number})"
        trans = trans_ur or trans_en
        trans_label = "ترجمہ:"
        translit_label = "تلفظ:"
    elif lang == "hi":
        header = f"सूरह {name_en} ({surah_number}:{ayah_number})"
        trans = trans_en
        trans_label = "अनुवाद:"
        translit_label = "लिप्यंतरण:"
    else:
        header = f"Quran {surah_number}:{ayah_number} — {name_en}"
        if name_tr:
            header += f" ({name_tr})"
        trans = trans_en
        trans_label = "Translation:"
        translit_label = "Transliteration:"

    lines = [header, "", arabic]
    if translit:
        lines.append("")
        lines.append(f"{translit_label} {translit}")
    if trans:
        lines.append("")
        lines.append(f"{trans_label} {trans}")

    return "\n".join(lines)


def format_surah_summary_answer(surah_number: int, lang: str, question: str = "") -> str:
    with get_cursor() as cur:
        _run_query(
            cur,
            "SELECT name_en, name_en_translation, ayah_count, revelation_type FROM surahs WHERE number = ?",
            (surah_number,),
        )
        surah = cur.fetchone()
        _run_query(
            cur,
            """
            SELECT ayah_number, arabic, translation_en, translation_ur, transliteration
            FROM ayahs WHERE surah_number = ? ORDER BY ayah_number
            """,
            (surah_number,),
        )
        ayahs = cur.fetchall()

    if not surah or not ayahs:
        return "Surah not found."

    if use_sqlite():
        name_en, name_tr, ayah_count, rev = surah
    else:
        name_en = surah["name_en"]
        name_tr = surah["name_en_translation"]
        ayah_count = surah["ayah_count"]
        rev = surah["revelation_type"]

    tafsir_anchors = _tafsir_anchor_ayahs(ayah_count)
    tafsir_en, tafsir_ur = _fetch_tafsir_at_ayahs(surah_number, tafsir_anchors)
    primary_tafsir = next(iter(tafsir_en.values()), "")

    if lang == "ur":
        header = f"سورہ {name_en} ({surah_number})"
        if name_tr:
            header += f" — {name_tr}"
        header += f" · {ayah_count} آیات · {rev}"
        teaching_label = "اہم تعلیمات:"
        footer = "مکمل آیات اور تفسیر ذیل میں ذرائع میں دستیاب ہیں۔"
    elif lang == "hi":
        header = f"सूरह {name_en} ({surah_number})"
        if name_tr:
            header += f" — {name_tr}"
        header += f" · {ayah_count} आयतें · {rev}"
        teaching_label = "मुख्य शिक्षाएँ:"
        footer = "पूर्ण आयतें और तफ़सीर नीचे स्रोतों में उपलब्ध हैं।"
    else:
        header = f"Surah {name_en} ({surah_number})"
        if name_tr:
            header += f" — {name_tr}"
        header += f" · {ayah_count} ayahs · {rev}"
        teaching_label = "Main teachings:"
        footer = "Full ayah text and tafsir are available in the sources below."

    bullets = _build_surah_teaching_bullets(ayahs, lang, tafsir_en, tafsir_ur)
    if not bullets:
        bullets = [
            row[2] if use_sqlite() else row["translation_en"]
            for row in ayahs[:3]
        ]

    wants_period = bool(PERIOD_HINT.search(question)) if question else False
    lines = [header, "", teaching_label]
    for bullet in bullets:
        lines.append(f"• {bullet}")
    if wants_period:
        lines.extend(["", _period_note(rev, primary_tafsir, lang)])
    lines.extend(["", footer])
    return "\n".join(lines)
