"""Render a saved live-khutba transcript as a PDF.

Built server-side rather than in the browser because Arabic and Urdu need real
text shaping: the letters are cursive and change form by position, so a PDF
writer that just places codepoints produces disconnected glyphs in the wrong
order. fpdf2 runs the text through HarfBuzz (`set_text_shaping`) against an
embedded Amiri face, which keeps the output as selectable text instead of the
flattened screenshot an html-to-canvas approach would give.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

from fpdf import FPDF

FONT_PATH = Path(__file__).resolve().parent.parent / "assets" / "Amiri-Regular.ttf"
FONT = "amiri"

# Amiri covers Latin as well as Arabic, so one face serves every column and the
# document never has to switch fonts mid-line.
TITLE_SIZE = 18
META_SIZE = 9
ARABIC_SIZE = 15
BODY_SIZE = 11
LABEL_SIZE = 8

INK = (23, 23, 23)
MUTED = (115, 115, 115)
ACCENT = (13, 108, 89)
RULE = (224, 224, 224)


@dataclass
class KhutbaLine:
    arabic: str
    english: str
    urdu: str


def _fmt_date(iso: str) -> str:
    try:
        return datetime.fromisoformat(iso.replace("Z", "+00:00")).strftime("%d %B %Y, %H:%M")
    except ValueError:
        return iso


class _KhutbaPDF(FPDF):
    def __init__(self, title: str) -> None:
        super().__init__(format="A4")
        self.doc_title = title
        self.set_auto_page_break(auto=True, margin=18)
        self.add_font(FONT, "", str(FONT_PATH))
        self.set_text_shaping(True)

    def footer(self) -> None:
        self.set_y(-15)
        self.set_font(FONT, size=LABEL_SIZE)
        self.set_text_color(*MUTED)
        self.cell(0, 8, f"Noor Safar  ·  {self.page_no()}", align="C")


def _block(pdf: _KhutbaPDF, label: str, text: str, size: int, rtl: bool) -> None:
    """One labelled column of a transcript line; skipped when empty."""
    if not text.strip():
        return
    pdf.set_font(FONT, size=LABEL_SIZE)
    pdf.set_text_color(*ACCENT)
    pdf.cell(0, 5, label, new_x="LMARGIN", new_y="NEXT", align="R" if rtl else "L")
    pdf.set_font(FONT, size=size)
    pdf.set_text_color(*INK)
    pdf.multi_cell(0, size * 0.62, text.strip(), new_x="LMARGIN", new_y="NEXT", align="R" if rtl else "L")
    pdf.ln(1.5)


def build_khutba_pdf(
    *,
    title: str,
    saved_at: str,
    location: str,
    lines: list[KhutbaLine],
    coverage: str = "",
) -> bytes:
    pdf = _KhutbaPDF(title)
    pdf.add_page()

    pdf.set_font(FONT, size=TITLE_SIZE)
    pdf.set_text_color(*INK)
    pdf.multi_cell(0, 9, title, new_x="LMARGIN", new_y="NEXT")

    meta = _fmt_date(saved_at)
    if location.strip():
        meta = f"{meta}  ·  {location.strip()}"
    pdf.set_font(FONT, size=META_SIZE)
    pdf.set_text_color(*MUTED)
    pdf.multi_cell(0, 5, meta, new_x="LMARGIN", new_y="NEXT")
    if coverage.strip():
        pdf.multi_cell(0, 5, coverage.strip(), new_x="LMARGIN", new_y="NEXT")

    pdf.ln(3)
    pdf.set_draw_color(*RULE)
    pdf.line(pdf.l_margin, pdf.get_y(), pdf.w - pdf.r_margin, pdf.get_y())
    pdf.ln(5)

    for index, line in enumerate(lines):
        if index:
            pdf.set_draw_color(*RULE)
            pdf.line(pdf.l_margin, pdf.get_y(), pdf.w - pdf.r_margin, pdf.get_y())
            pdf.ln(4)
        _block(pdf, "ARABIC", line.arabic, ARABIC_SIZE, rtl=True)
        _block(pdf, "ENGLISH", line.english, BODY_SIZE, rtl=False)
        _block(pdf, "اردو", line.urdu, BODY_SIZE, rtl=True)

    out = pdf.output()
    return bytes(out)
