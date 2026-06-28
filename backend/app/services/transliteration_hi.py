"""Devanagari → roman (ITRANS) for Hindi Quran text."""

try:
    from indic_transliteration import sanscript
    from indic_transliteration.sanscript import transliterate

    def hindi_to_roman(text: str) -> str:
        if not text or not text.strip():
            return ""
        return transliterate(text, sanscript.DEVANAGARI, sanscript.ITRANS)

except ImportError:

    def hindi_to_roman(text: str) -> str:
        return ""
