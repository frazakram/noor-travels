"""Shared Arabic text normalization -- used by recitation scoring (app/api/recite.py)
and screenshot verse matching (app/services/quran_identify.py) so OCR/transcribed
text and canonical Quran text compare on equal footing.
"""

import re

# Marks stripped before comparison: harakat, Quranic annotation signs,
# superscript alef, tatweel, small high/low marks.
_MARKS = re.compile("[ؐ-ًؚ-ٰٟۖ-ۭۥۦـ࣓-ࣿ]")
_ALEF_FORMS = re.compile("[آأإٱ]")
_NON_ARABIC = re.compile("[^ء-ي ]")

def normalize_arabic(text: str) -> str:
    """Fold Uthmani orthography and diacritics so the Quran text and Whisper's
    plain transcription compare on equal footing."""
    # Uthmani long-a spellings: الصلوٰة → الصلاة, موسىٰ keeps its alef maqsura.
    t = text.replace("وٰ", "ا")  # وٰ → ا
    t = t.replace("ىٰ", "ى")  # ىٰ → ى
    t = _MARKS.sub("", t)
    t = _ALEF_FORMS.sub("ا", t)
    t = t.replace("ى", "ي")  # ى → ي
    t = t.replace("ة", "ه")  # ة → ه
    t = _NON_ARABIC.sub(" ", t)
    return re.sub(r"\s+", " ", t).strip()
