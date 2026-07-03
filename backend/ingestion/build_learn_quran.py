#!/usr/bin/env python3
"""Build Learn Quran course JSON for web + Android WebView."""
from __future__ import annotations

import json
import re
import sqlite3
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parent
SRC = REPO / "data" / "sources" / "learn-quran"
OUT = REPO / "frontend" / "public" / "data" / "learn-quran"
DB = ROOT / "data" / "noor_safar.db"

QURAN_COM_VERSE = "https://api.quran.com/api/v4/verses/by_key/{key}?words=true&word_fields=text_uthmani,translation,transliteration"


def _norm_arabic(text: str) -> str:
    return re.sub(r"[\u064b-\u065f\u0670\u06d6-\u06ed\ufeff]", "", text or "").strip()


# ── High-frequency vocabulary (Dr. Abdulraheem methodology, ~82% coverage path) ──

VOCAB_LESSONS: list[dict] = [
    {
        "id": "vocab-01",
        "module_id": "m1-core",
        "order": 1,
        "title_en": "Allah, negation & except",
        "title_ur": "اللہ، نفی اور استثنا",
        "title_hi": "अल्लाह, नफी और इस्तिस्ना",
        "coverage_pct": 8.5,
        "intro_en": "These five words appear constantly. Master them first — they unlock La ilaha illallah and hundreds of ayahs.",
        "words": [
            {"ar": "ٱللَّه", "tr": "Allah", "en": "Allah", "ur": "اللہ", "hi": "अल्लाह", "freq": 2699},
            {"ar": "لَا", "tr": "lā", "en": "no; not", "ur": "نہیں", "hi": "नहीं", "freq": 1735},
            {"ar": "إِلَّا", "tr": "illā", "en": "except; but", "ur": "مگر؛ سوائے", "hi": "सिवाय; मगर", "freq": 663},
            {"ar": "إِنَّ", "tr": "inna", "en": "indeed; verily", "ur": "بیشک", "hi": "बेशक", "freq": 1534},
            {"ar": "أَنَّ", "tr": "anna", "en": "that indeed", "ur": "یقیناً کہ", "hi": "निश्चय ही कि", "freq": 518},
        ],
    },
    {
        "id": "vocab-02",
        "module_id": "m1-core",
        "order": 2,
        "title_en": "This, that, he, she, they",
        "title_ur": "یہ، وہ، وہی لوگ",
        "title_hi": "यह, वह, वे लोग",
        "coverage_pct": 12.0,
        "intro_en": "Demonstratives and pronouns — about 15% of the Quran alone when combined with lesson 1.",
        "words": [
            {"ar": "هُوَ", "tr": "huwa", "en": "he; it (m)", "ur": "وہ (م)", "hi": "वह (पु)", "freq": 1116},
            {"ar": "هِيَ", "tr": "hiya", "en": "she; it (f)", "ur": "وہ (مؤ)", "hi": "वह (स्त्री)", "freq": 374},
            {"ar": "هُمْ", "tr": "hum", "en": "they (m)", "ur": "وہ (جمع م)", "hi": "वे (पु)", "freq": 644},
            {"ar": "هُنَّ", "tr": "hunna", "en": "they (f)", "ur": "وہ (جمع مؤ)", "hi": "वे (स्त्री)", "freq": 89},
            {"ar": "أَنْتَ", "tr": "anta", "en": "you (m)", "ur": "تم (م)", "hi": "तुम (पु)", "freq": 203},
            {"ar": "أَنْتُمْ", "tr": "antum", "en": "you all (m)", "ur": "تم سب", "hi": "तुम सब", "freq": 382},
            {"ar": "نَحْنُ", "tr": "naḥnu", "en": "we", "ur": "ہم", "hi": "हम", "freq": 130},
            {"ar": "أَنَا", "tr": "anā", "en": "I", "ur": "میں", "hi": "मैं", "freq": 50},
            {"ar": "هَٰذَا", "tr": "hādhā", "en": "this (m)", "ur": "یہ (م)", "hi": "यह (पु)", "freq": 75},
            {"ar": "هَٰذِهِ", "tr": "hādhihi", "en": "this (f)", "ur": "یہ (مؤ)", "hi": "यह (स्त्री)", "freq": 23},
            {"ar": "ذَٰلِكَ", "tr": "dhālika", "en": "that (m)", "ur": "وہ (م)", "hi": "वह (पु)", "freq": 208},
            {"ar": "تِلْكَ", "tr": "tilka", "en": "that (f)", "ur": "وہ (مؤ)", "hi": "वह (स्त्री)", "freq": 27},
            {"ar": "ٱلَّذِينَ", "tr": "alladhīna", "en": "those who (m pl)", "ur": "وہ لوگ جنہوں نے", "hi": "वे लोग जिन्होंने", "freq": 900},
            {"ar": "مَن", "tr": "man", "en": "who; whoever", "ur": "جو", "hi": "जो", "freq": 401},
            {"ar": "مَا", "tr": "mā", "en": "what; that which; not", "ur": "جو؛ کیا", "hi": "जो; क्या", "freq": 2400},
        ],
    },
    {
        "id": "vocab-03",
        "module_id": "m1-core",
        "order": 3,
        "title_en": "Essential prepositions",
        "title_ur": "اہم حروف جار",
        "title_hi": "ज़रूरी हुरूफ़-ए-जार",
        "coverage_pct": 18.0,
        "intro_en": "Prepositions glue Arabic sentences together. Learn them with the verbs they pair with.",
        "words": [
            {"ar": "فِي", "tr": "fī", "en": "in", "ur": "میں", "hi": "में", "freq": 1700},
            {"ar": "مِن", "tr": "min", "en": "from; of; among", "ur": "سے؛ میں سے", "hi": "से; में से", "freq": 3226},
            {"ar": "إِلَىٰ", "tr": "ilā", "en": "to; towards", "ur": "کی طرف", "hi": "की ओर", "freq": 742},
            {"ar": "عَلَىٰ", "tr": "ʿalā", "en": "upon; on; over", "ur": "پر", "hi": "पर", "freq": 1400},
            {"ar": "عَن", "tr": "ʿan", "en": "about; from; concerning", "ur": "کے بارے میں؛ سے", "hi": "के बारे में; से", "freq": 1098},
            {"ar": "بِ", "tr": "bi", "en": "with; by; in", "ur": "سے؛ کے ساتھ", "hi": "से; के साथ", "freq": 1400},
            {"ar": "لِ", "tr": "li", "en": "for; to; belonging to", "ur": "کے لیے", "hi": "के लिए", "freq": 1100},
            {"ar": "وَ", "tr": "wa", "en": "and", "ur": "اور", "hi": "और", "freq": 4700},
            {"ar": "كَ", "tr": "ka", "en": "as; like", "ur": "جیسے", "hi": "जैसे", "freq": 200},
            {"ar": "بَيْنَ", "tr": "bayna", "en": "between", "ur": "درمیان", "hi": "बीच में", "freq": 58},
            {"ar": "قَبْلَ", "tr": "qabla", "en": "before", "ur": "پہلے", "hi": "पहले", "freq": 65},
            {"ar": "بَعْدَ", "tr": "baʿda", "en": "after", "ur": "بعد", "hi": "बाद", "freq": 45},
        ],
    },
    {
        "id": "vocab-04",
        "module_id": "m1-core",
        "order": 4,
        "title_en": "Names of Allah in the Quran",
        "title_ur": "قرآن میں اللہ کے نام",
        "title_hi": "क़ुरआन में अल्लाह के नाम",
        "coverage_pct": 22.0,
        "intro_en": "These divine names repeat across the Quran and carry precise meanings.",
        "words": [
            {"ar": "ٱلرَّحْمَٰن", "tr": "ar-Raḥmān", "en": "the Most Gracious", "ur": "نہایت مہربان", "hi": "अत्यंत दयालु", "freq": 57},
            {"ar": "ٱلرَّحِيم", "tr": "ar-Raḥīm", "en": "the Most Merciful", "ur": "بڑا رحم کرنے والا", "hi": "अत्यंत रहमान", "freq": 114},
            {"ar": "رَبّ", "tr": "rabb", "en": "Lord; Sustainer", "ur": "رب؛ پروردگار", "hi": "रब; पालनहार", "freq": 980},
            {"ar": "ٱلْعَزِيز", "tr": "al-ʿAzīz", "en": "the Almighty", "ur": "غالب", "hi": "सर्वशक्तिमान", "freq": 92},
            {"ar": "ٱلْحَكِيم", "tr": "al-Ḥakīm", "en": "the All-Wise", "ur": "حکیم", "hi": "हिकमत वाला", "freq": 98},
            {"ar": "ٱلْعَلِيم", "tr": "al-ʿAlīm", "en": "the All-Knowing", "ur": "علیم", "hi": "सर्वज्ञ", "freq": 158},
            {"ar": "ٱلْخَبِير", "tr": "al-Khabīr", "en": "the All-Aware", "ur": "خبیر", "hi": "पूरी ख़बर रखने वाला", "freq": 45},
            {"ar": "ٱلْقَدِير", "tr": "al-Qadīr", "en": "the All-Powerful", "ur": "قدرت والا", "hi": "सर्वशक्तिमान", "freq": 45},
            {"ar": "ٱلْغَفُور", "tr": "al-Ghafūr", "en": "the Oft-Forgiving", "ur": "بخشنے والا", "hi": "बहुत बख्शने वाला", "freq": 91},
            {"ar": "ٱلرَّحِيم", "tr": "ar-Raḥīm", "en": "the Especially Merciful", "ur": "رحیم", "hi": "रहम करने वाला", "freq": 114},
        ],
    },
    {
        "id": "vocab-05",
        "module_id": "m1-core",
        "order": 5,
        "title_en": "Question words & time",
        "title_ur": "سوالیہ الفاظ اور وقت",
        "title_hi": "सवाल के अलफ़ाज़ और वक़्त",
        "coverage_pct": 28.0,
        "intro_en": "Questions appear throughout stories of prophets and arguments with disbelievers.",
        "words": [
            {"ar": "كَيْفَ", "tr": "kayfa", "en": "how?", "ur": "کیسے؟", "hi": "कैसे?", "freq": 82},
            {"ar": "أَيْنَ", "tr": "ayna", "en": "where?", "ur": "کہاں؟", "hi": "कहाँ?", "freq": 27},
            {"ar": "مَتَىٰ", "tr": "matā", "en": "when?", "ur": "کب؟", "hi": "कब?", "freq": 46},
            {"ar": "لِمَ", "tr": "lima", "en": "why?", "ur": "کیوں؟", "hi": "क्यों?", "freq": 32},
            {"ar": "أَيّ", "tr": "ayy", "en": "which?", "ur": "کون سا؟", "hi": "कौन सा?", "freq": 20},
            {"ar": "يَوْم", "tr": "yawm", "en": "day", "ur": "دن", "hi": "दिन", "freq": 475},
            {"ar": "ٱلْآخِرَة", "tr": "al-ākhirah", "en": "the Hereafter", "ur": "آخرت", "hi": "आख़िरत", "freq": 117},
            {"ar": "ٱلدُّنْيَا", "tr": "ad-dunyā", "en": "the world", "ur": "دنیا", "hi": "दुनिया", "freq": 115},
            {"ar": "ٱلسَّمَاء", "tr": "as-samāʾ", "en": "the heaven; sky", "ur": "آسمان", "hi": "आसमान", "freq": 120},
            {"ar": "ٱلْأَرْض", "tr": "al-arḍ", "en": "the earth", "ur": "زمین", "hi": "ज़मीन", "freq": 461},
        ],
    },
    {
        "id": "vocab-06",
        "module_id": "m1-core",
        "order": 6,
        "title_en": "Faith, book & messenger",
        "title_ur": "ایمان، کتاب اور رسول",
        "title_hi": "ईमान, किताब और रसूल",
        "coverage_pct": 35.0,
        "intro_en": "Core Islamic vocabulary — appears in nearly every surah.",
        "words": [
            {"ar": "ءَامَنَ", "tr": "āmana", "en": "he believed", "ur": "اس نے ایمان لایا", "hi": "उसने ईमान लाया", "freq": 537, "root": "ء م ن"},
            {"ar": "كِتَاب", "tr": "kitāb", "en": "book; scripture", "ur": "کتاب", "hi": "किताब", "freq": 260},
            {"ar": "قُرْءَان", "tr": "Qurʾān", "en": "Quran", "ur": "قرآن", "hi": "क़ुरआन", "freq": 70},
            {"ar": "رَسُول", "tr": "rasūl", "en": "messenger", "ur": "رسول", "hi": "रसूल", "freq": 214},
            {"ar": "نَبِيّ", "tr": "nabiyy", "en": "prophet", "ur": "نبی", "hi": "नबी", "freq": 75},
            {"ar": "إِيمَان", "tr": "īmān", "en": "faith", "ur": "ایمان", "hi": "ईमान", "freq": 45},
            {"ar": "صَلَاة", "tr": "ṣalāh", "en": "prayer", "ur": "نماز", "hi": "नमाज़", "freq": 99},
            {"ar": "زَكَاة", "tr": "zakāh", "en": "obligatory charity", "ur": "زکوٰة", "hi": "ज़कात", "freq": 30},
            {"ar": "جَنَّة", "tr": "jannah", "en": "Paradise", "ur": "جنت", "hi": "जन्नत", "freq": 147},
            {"ar": "نَار", "tr": "nār", "en": "fire; Hellfire", "ur": "آگ؛ جہنم", "hi": "आग; जहन्नम", "freq": 145},
            {"ar": "شَيْطَان", "tr": "shayṭān", "en": "Satan", "ur": "شیطان", "hi": "शैतान", "freq": 88},
            {"ar": "مَلَك", "tr": "malak", "en": "angel", "ur": "فرشتہ", "hi": "फ़रिश्ता", "freq": 88},
        ],
    },
    {
        "id": "vocab-07",
        "module_id": "m2-nouns",
        "order": 1,
        "title_en": "People & family",
        "title_ur": "لوگ اور خاندان",
        "title_hi": "लोग और परिवार",
        "coverage_pct": 42.0,
        "intro_en": "Nouns about people — essential for stories of prophets and nations.",
        "words": [
            {"ar": "نَاس", "tr": "nās", "en": "people; mankind", "ur": "لوگ", "hi": "लोग", "freq": 241},
            {"ar": "رَجُل", "tr": "rajul", "en": "man", "ur": "آدمی", "hi": "आदमी", "freq": 58},
            {"ar": "ٱمْرَأَة", "tr": "imraʾah", "en": "woman", "ur": "عورت", "hi": "औरत", "freq": 24},
            {"ar": "وَلَد", "tr": "walad", "en": "child; son", "ur": "بیٹا؛ بچہ", "hi": "बेटा; बच्चा", "freq": 42},
            {"ar": "أَب", "tr": "ab", "en": "father", "ur": "باپ", "hi": "बाप", "freq": 46},
            {"ar": "أُمّ", "tr": "umm", "en": "mother", "ur": "ماں", "hi": "माँ", "freq": 35},
            {"ar": "أَهْل", "tr": "ahl", "en": "family; people of", "ur": "اہل؛ خاندان", "hi": "अहल; परिवार", "freq": 65},
            {"ar": "قَوْم", "tr": "qawm", "en": "nation; people", "ur": "قوم", "hi": "क़ौम", "freq": 383},
            {"ar": "بَنِي", "tr": "banī", "en": "children of; sons of", "ur": "اولاد", "hi": "संतान", "freq": 50},
            {"ar": "عِبَاد", "tr": "ʿibād", "en": "servants; worshippers", "ur": "بندے", "hi": "बंदे", "freq": 275},
        ],
    },
    {
        "id": "vocab-08",
        "module_id": "m2-nouns",
        "order": 2,
        "title_en": "Heart, soul & body",
        "title_ur": "دل، روح اور جسم",
        "title_hi": "दिल, रूह और जिस्म",
        "coverage_pct": 48.0,
        "intro_en": "Inner states the Quran describes constantly — key for spiritual understanding.",
        "words": [
            {"ar": "قَلْب", "tr": "qalb", "en": "heart", "ur": "دل", "hi": "दिल", "freq": 168},
            {"ar": "نَفْس", "tr": "nafs", "en": "soul; self", "ur": "نفس", "hi": "नफ़्स", "freq": 298},
            {"ar": "عَيْن", "tr": "ʿayn", "en": "eye", "ur": "آنکھ", "hi": "आँख", "freq": 84},
            {"ar": "وَجْه", "tr": "wajh", "en": "face", "ur": "چہرہ", "hi": "चेहरा", "freq": 46},
            {"ar": "يَد", "tr": "yad", "en": "hand", "ur": "ہاتھ", "hi": "हाथ", "freq": 87},
            {"ar": "صَدْر", "tr": "ṣadr", "en": "chest; breast", "ur": "سینہ", "hi": "सीना", "freq": 40},
            {"ar": "عَقْل", "tr": "ʿaql", "en": "intellect; reason", "ur": "عقل", "hi": "अक़्ल", "freq": 12},
            {"ar": "سَمْع", "tr": "samʿ", "en": "hearing", "ur": "سننا", "hi": "सुनना", "freq": 25},
            {"ar": "بَصَر", "tr": "baṣar", "en": "sight", "ur": "بصارت", "hi": "नज़र", "freq": 30},
        ],
    },
    {
        "id": "vocab-09",
        "module_id": "m3-verbs",
        "order": 1,
        "title_en": "Know, say, do — core verbs",
        "title_ur": "جاننا، کہنا، کرنا",
        "title_hi": "जानना, कहना, करना",
        "coverage_pct": 55.0,
        "intro_en": "The most frequent Quranic verbs. Learn past (he did) form first.",
        "words": [
            {"ar": "قَالَ", "tr": "qāla", "en": "he said", "ur": "اس نے کہا", "hi": "उसने कहा", "freq": 1618, "root": "ق و ل"},
            {"ar": "كَانَ", "tr": "kāna", "en": "he was; it was", "ur": "وہ تھا", "hi": "वह था", "freq": 1358, "root": "ك و ن"},
            {"ar": "جَعَلَ", "tr": "jaʿala", "en": "he made; placed", "ur": "اس نے بنایا", "hi": "उसने बनाया", "freq": 335, "root": "ج ع ل"},
            {"ar": "عَلِمَ", "tr": "ʿalima", "en": "he knew", "ur": "اس نے جانا", "hi": "उसने जाना", "freq": 382, "root": "ع ل م"},
            {"ar": "أَتَىٰ", "tr": "atā", "en": "he came; brought", "ur": "وہ آیا", "hi": "वह आया", "freq": 537, "root": "أ ت ي"},
            {"ar": "أَرْسَلَ", "tr": "arsala", "en": "he sent", "ur": "اس نے بھیجا", "hi": "उसने भेजा", "freq": 130, "root": "ر س ل"},
            {"ar": "خَلَقَ", "tr": "khalaqa", "en": "he created", "ur": "اس نے پیدا کیا", "hi": "उसने पैदा किया", "freq": 184, "root": "خ ل ق"},
            {"ar": "أَنزَلَ", "tr": "anzala", "en": "he sent down (revealed)", "ur": "اس نے نازل کیا", "hi": "उसने नाज़िल किया", "freq": 212, "root": "ن ز ل"},
            {"ar": "فَعَلَ", "tr": "faʿala", "en": "he did", "ur": "اس نے کیا", "hi": "उसने किया", "freq": 167, "root": "ف ع ل"},
            {"ar": "جَاءَ", "tr": "jāʾa", "en": "he came", "ur": "وہ آیا", "hi": "वह आया", "freq": 289, "root": "ج ي أ"},
        ],
    },
    {
        "id": "vocab-10",
        "module_id": "m3-verbs",
        "order": 2,
        "title_en": "Guide, forgive, fear, hope",
        "title_ur": "ہدایت، مغفرت، خوف، امید",
        "title_hi": "हिदायत, मग़फिरत, ख़ौफ़, उम्मीद",
        "coverage_pct": 62.0,
        "intro_en": "Spiritual verbs — the emotional vocabulary of the Quran.",
        "words": [
            {"ar": "هَدَىٰ", "tr": "hadā", "en": "he guided", "ur": "اس نے ہدایت دی", "hi": "उसने हिदायत दी", "freq": 79, "root": "ه د ي"},
            {"ar": "غَفَرَ", "tr": "ghafara", "en": "he forgave", "ur": "اس نے بخشا", "hi": "उसने बख्शा", "freq": 34, "root": "غ ف ر"},
            {"ar": "خَافَ", "tr": "khāfa", "en": "he feared", "ur": "اس نے ڈرا", "hi": "उसने डरा", "freq": 131, "root": "خ و ف"},
            {"ar": "رَجَا", "tr": "rajā", "en": "he hoped", "ur": "اس نے امید کی", "hi": "उसने उम्मीद की", "freq": 40, "root": "ر ج و"},
            {"ar": "ذَكَرَ", "tr": "dhakara", "en": "he remembered; mentioned", "ur": "اس نے یاد کیا", "hi": "उसने याद किया", "freq": 63, "root": "ذ ك ر"},
            {"ar": "نَسِيَ", "tr": "nasiya", "en": "he forgot", "ur": "وہ بھول گیا", "hi": "वह भूल गया", "freq": 40, "root": "ن س ي"},
            {"ar": "شَكَرَ", "tr": "shakara", "en": "he thanked", "ur": "اس نے شکر کیا", "hi": "उसने शुक्र किया", "freq": 21, "root": "ش ك ر"},
            {"ar": "كَفَرَ", "tr": "kafara", "en": "he disbelieved", "ur": "اس نے کفر کیا", "hi": "उसने कुफ़्र किया", "freq": 525, "root": "ك ف ر"},
            {"ar": "ظَلَمَ", "tr": "ẓalama", "en": "he wronged; was unjust", "ur": "اس نے ظلم کیا", "hi": "उसने ज़ुल्म किया", "freq": 315, "root": "ظ ل م"},
            {"ar": "عَبَدَ", "tr": "ʿabada", "en": "he worshipped", "ur": "اس نے عبادت کی", "hi": "उसने इबादत की", "freq": 46, "root": "ع ب د"},
        ],
    },
]

GRAMMAR_LESSONS: list[dict] = [
    {
        "id": "grammar-01",
        "module_id": "m4-grammar",
        "order": 1,
        "title_en": "The definite article ال",
        "title_ur": "تعریف ال",
        "title_hi": "अरफ़ अल-",
        "intro_en": "From Madinah Arabic Book 1 — ال makes a noun definite (the). Sun letters assimilate; moon letters keep ال clear.",
        "sections": [
            {
                "heading_en": "What ال does",
                "body_en": "الْ + كِتَاب = ٱلْكِتَاب (the book). It appears thousands of times in the Quran.",
                "examples": [{"ar": "ٱلْحَمْدُ لِلَّهِ", "en": "All praise is for Allah", "note": "الْحَمْدُ = the praise"}],
            },
            {
                "heading_en": "Sun & moon letters",
                "body_en": "After sun letters (ت ث د ذ ر ز س ش ص ض ط ظ ل ن), the ل of ال is silent and the next letter doubles. Moon letters keep the ل pronounced.",
                "examples": [{"ar": "ٱلشَّمْس", "en": "the sun (shams — sun letter)", "note": ""}, {"ar": "ٱلْقَمَر", "en": "the moon (qamar — moon letter)", "note": ""}],
            },
        ],
        "practice": [
            {"q_en": "What does الْعَالَمِينَ mean?", "options": ["the worlds", "a world", "my world"], "answer": 0},
            {"q_en": "ال before a noun usually means?", "options": ["the (definite)", "and", "in"], "answer": 0},
        ],
    },
    {
        "id": "grammar-02",
        "module_id": "m4-grammar",
        "order": 2,
        "title_en": "Nominal sentence (جملة اسمية)",
        "title_ur": "جملہ اسمیہ",
        "title_hi": "इस्मी जुमला",
        "intro_en": "Many Quranic ayahs are nominal sentences: subject (مبتدأ) + predicate (خبر). No 'is' needed in Arabic.",
        "sections": [
            {
                "heading_en": "Structure",
                "body_en": "ٱللَّهُ (mubtadaʾ) + رَبُّ (khabar) = Allah is the Lord. Both are marfūʿ (nominative).",
                "examples": [{"ar": "ٱللَّهُ نُورُ ٱلسَّمَٰوَٰتِ", "en": "Allah is the Light of the heavens", "note": "نُورُ = predicate"}],
            },
        ],
        "practice": [
            {"q_en": "In ٱلْحَمْدُ لِلَّهِ, what is الْحَمْدُ?", "options": ["subject (mubtadaʾ)", "verb", "preposition"], "answer": 0},
        ],
    },
    {
        "id": "grammar-03",
        "module_id": "m4-grammar",
        "order": 3,
        "title_en": "Prepositions in context",
        "title_ur": "حروف جار کے ساتھ استعمال",
        "title_hi": "हुरूफ़-ए-जार का इस्तेमाल",
        "intro_en": "Prepositions change the ending of the following noun (genitive / majrūr). This pattern appears in almost every ayah.",
        "sections": [
            {
                "heading_en": "في + noun",
                "body_en": "فِي السَّمَاء = in the heaven. The noun after في takes kasra (genitive).",
                "examples": [{"ar": "فِي قُلُوبِهِم مَّرَضٌ", "en": "In their hearts is disease", "note": "فِي + قُلُوبِ"}],
            },
            {
                "heading_en": "من + noun",
                "body_en": "مِنَ السَّمَاء = from the heaven. من shows origin, part-of, or explanation.",
                "examples": [{"ar": "مِنْهُم مَّنْ", "en": "Among them is he who...", "note": "من for partitive"}],
            },
        ],
        "practice": [
            {"q_en": "بِسْمِ اللَّهِ — بِ means?", "options": ["with / by / in", "from", "upon"], "answer": 0},
        ],
    },
    {
        "id": "grammar-04",
        "module_id": "m4-grammar",
        "order": 4,
        "title_en": "Past tense verb (فعل ماض)",
        "title_ur": "فعل ماضی",
        "title_hi": "फ़ेल माज़ी",
        "intro_en": "Quranic narrative uses past tense constantly. Pattern: فَعَلَ (he did) — three root letters with vowels.",
        "sections": [
            {
                "heading_en": "Root pattern",
                "body_en": "Root ق-و-ل → قَالَ (he said), يَقُولُ (he says), قُلْ (say!). Learn the past form first.",
                "examples": [{"ar": "خَلَقَ ٱلسَّمَٰوَٰتِ", "en": "He created the heavens", "note": "خ-ل-ق root"}],
            },
        ],
        "practice": [
            {"q_en": "قَالَ is past tense of which root?", "options": ["ق و ل (say)", "ك و ن (be)", "ع ل م (know)"], "answer": 0},
        ],
    },
    {
        "id": "grammar-05",
        "module_id": "m4-grammar",
        "order": 5,
        "title_en": "إنَّ and its sisters",
        "title_ur": "إنَّ اور اس کی بہنیں",
        "title_hi": "इन्ना और उसकी बहनें",
        "intro_en": "Particles like إنَّ, أنَّ, لكنَّ emphasize and change case — very common in Quran.",
        "sections": [
            {
                "heading_en": "إنَّ + noun",
                "body_en": "إِنَّ اللَّهَ — indeed Allah (accusative after إنَّ). Different from إِن (if).",
                "examples": [{"ar": "إِنَّ ٱلْإِنسَٰنَ لَفِي خُسْرٍ", "en": "Indeed mankind is in loss", "note": "إنَّ emphasizes"}],
            },
        ],
        "practice": [
            {"q_en": "إِنَّ usually means?", "options": ["indeed / verily", "if", "not"], "answer": 0},
        ],
    },
]

ROOT_LESSONS: list[dict] = [
    {
        "id": "roots-01",
        "module_id": "m5-roots",
        "order": 1,
        "title_en": "Root ع-ل-م (knowledge)",
        "title_ur": "جذر ع-ل-م",
        "title_hi": "जड़़ ع-ल-म",
        "intro_en": "Dr. Nadwi's root method — one root unlocks a family of words.",
        "roots": [
            {"root": "ع ل م", "words": [
                {"ar": "عَلِمَ", "en": "he knew"},
                {"ar": "عِلْم", "en": "knowledge"},
                {"ar": "عَلِيم", "en": "All-Knowing"},
                {"ar": "عَالِم", "en": "scholar"},
                {"ar": "مَعْلُوم", "en": "known"},
            ]},
        ],
        "practice_ayah": "96:5",
    },
    {
        "id": "roots-02",
        "module_id": "m5-roots",
        "order": 2,
        "title_en": "Root ك-ت-ب (writing)",
        "title_ur": "جذر ك-ت-ب",
        "title_hi": "जड़़ क-त-ब",
        "intro_en": "The book, writing, and decree — all from one root.",
        "roots": [
            {"root": "ك ت ب", "words": [
                {"ar": "كَتَبَ", "en": "he wrote"},
                {"ar": "كِتَاب", "en": "book"},
                {"ar": "كَاتِب", "en": "writer"},
                {"ar": "مَكْتُوب", "en": "written"},
                {"ar": "كُتُب", "en": "books"},
            ]},
        ],
        "practice_ayah": "2:2",
    },
    {
        "id": "roots-03",
        "module_id": "m5-roots",
        "order": 3,
        "title_en": "Root ر-ح-م (mercy)",
        "title_ur": "جذر ر-ح-م",
        "title_hi": "जड़़ र-ह-म",
        "intro_en": "From the same root: Rahman, Rahim, mercy, womb.",
        "roots": [
            {"root": "ر ح م", "words": [
                {"ar": "رَحِمَ", "en": "he showed mercy"},
                {"ar": "رَحْمَة", "en": "mercy"},
                {"ar": "رَحِيم", "en": "Merciful"},
                {"ar": "رَحْمَٰن", "en": "Most Gracious"},
                {"ar": "رَحِم", "en": "womb; kinship"},
            ]},
        ],
        "practice_ayah": "1:3",
    },
]

READING_LESSONS: list[dict] = [
    {"id": "read-01", "module_id": "m6-reading", "order": 1, "title_en": "Al-Fatiha — word by word", "title_ur": "الفاتحہ — لفظ بہ لفظ", "title_hi": "अल-फातिहा — शब्द दर शब्द", "verse_keys": ["1:1", "1:2", "1:3", "1:4", "1:5", "1:6", "1:7"], "hide_translation_after": 3},
    {"id": "read-02", "module_id": "m6-reading", "order": 2, "title_en": "Surah Al-Ikhlas", "title_ur": "سورہ اخلاص", "title_hi": "सूरह इख़लास", "verse_keys": ["112:1", "112:2", "112:3", "112:4"], "hide_translation_after": 2},
    {"id": "read-03", "module_id": "m6-reading", "order": 3, "title_en": "Surah Al-Falaq", "title_ur": "سورہ فلق", "title_hi": "सूरह फ़लक़", "verse_keys": ["113:1", "113:2", "113:3", "113:4", "113:5"], "hide_translation_after": 2},
    {"id": "read-04", "module_id": "m6-reading", "order": 4, "title_en": "Surah An-Nas", "title_ur": "سورہ ناس", "title_hi": "सूरह नास", "verse_keys": ["114:1", "114:2", "114:3", "114:4", "114:5", "114:6"], "hide_translation_after": 2},
    {"id": "read-05", "module_id": "m6-reading", "order": 5, "title_en": "Ayat al-Kursi (2:255)", "title_ur": "آیت الکرسی", "title_hi": "आयतुल कुर्सी", "verse_keys": ["2:255"], "hide_translation_after": 0},
    {"id": "read-06", "module_id": "m6-reading", "order": 6, "title_en": "Last verses of Al-Baqarah", "title_ur": "آخر البقرہ", "title_hi": "अल-बक़रा की आख़िरी आयतें", "verse_keys": ["2:285", "2:286"], "hide_translation_after": 1},
]

MODULES = [
    {"id": "m1-core", "order": 1, "title_en": "Core vocabulary", "title_ur": "بنیادی الفاظ", "title_hi": "मूल शब्दावली", "desc_en": "~35% of Quran words — start here", "icon": "⭐", "lesson_ids": [l["id"] for l in VOCAB_LESSONS if l["module_id"] == "m1-core"]},
    {"id": "m2-nouns", "order": 2, "title_en": "Essential nouns", "title_ur": "اہم اسماء", "title_hi": "ज़रूरी संज्ञाएँ", "desc_en": "People, body, and creation", "icon": "📚", "lesson_ids": [l["id"] for l in VOCAB_LESSONS if l["module_id"] == "m2-nouns"]},
    {"id": "m3-verbs", "order": 3, "title_en": "Essential verbs", "title_ur": "اہم افعال", "title_hi": "ज़रूरी फ़ेल", "desc_en": "Most frequent action words", "icon": "⚡", "lesson_ids": [l["id"] for l in VOCAB_LESSONS if l["module_id"] == "m3-verbs"]},
    {"id": "m4-grammar", "order": 4, "title_en": "Quranic grammar", "title_ur": "قرآنی قواعد", "title_hi": "क़ुरआनी क़वाइद", "desc_en": "Madinah Arabic essentials", "icon": "📝", "lesson_ids": [l["id"] for l in GRAMMAR_LESSONS]},
    {"id": "m5-roots", "order": 5, "title_en": "Root patterns", "title_ur": "جذور اور وزن", "title_hi": "जड़ें और वज़न", "desc_en": "Nadwi root methodology", "icon": "🌳", "lesson_ids": [l["id"] for l in ROOT_LESSONS]},
    {"id": "m6-reading", "order": 6, "title_en": "Guided reading", "title_ur": "ہدایت یافتہ مطالعہ", "title_hi": "मार्गदर्शित पढ़ाई", "desc_en": "Read Arabic with fading translation", "icon": "📖", "lesson_ids": [l["id"] for l in READING_LESSONS]},
]


def _fetch_verse_words(verse_key: str) -> dict | None:
    url = QURAN_COM_VERSE.format(key=verse_key)
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "NoorSafar/1.0"})
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = json.loads(resp.read())
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
        return None
    verse = data.get("verse") or {}
    words = []
    for w in verse.get("words") or []:
        if w.get("char_type_name") == "end":
            continue
        tr = (w.get("transliteration") or {}).get("text") or ""
        en = (w.get("translation") or {}).get("text") or ""
        words.append({
            "ar": w.get("text_uthmani") or w.get("text") or "",
            "tr": tr,
            "en": en,
        })
    return {"verse_key": verse_key, "words": words}


def _ayah_from_db(verse_key: str) -> dict | None:
    if not DB.exists():
        return None
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute(
        "SELECT verse_key, arabic, translation_en, translation_ur FROM ayahs WHERE verse_key = ?",
        (verse_key,),
    )
    row = cur.fetchone()
    conn.close()
    if not row:
        return None
    return dict(row)


def _attach_examples(lessons: list[dict]) -> None:
    if not DB.exists():
        return
    conn = sqlite3.connect(DB)
    cur = conn.cursor()
    for lesson in lessons:
        for word in lesson.get("words") or []:
            ar = _norm_arabic(word["ar"])
            if not ar:
                continue
            cur.execute(
                "SELECT verse_key, arabic FROM ayahs WHERE arabic LIKE ? LIMIT 2",
                (f"%{ar}%",),
            )
            examples = []
            for vk, ayah_ar in cur.fetchall():
                examples.append({"verse_key": vk, "snippet": ayah_ar[:120]})
            word["examples"] = examples
    conn.close()


def _build_quiz_for_vocab(lesson: dict) -> list[dict]:
    words = lesson.get("words") or []
    quiz = []
    for i, w in enumerate(words[:5]):
        others = [x for j, x in enumerate(words) if j != i][:3]
        options = [w["en"]] + [x["en"] for x in others]
        if len(options) < 4:
            options.extend(["and", "the", "in"])
        options = list(dict.fromkeys(options))[:4]
        quiz.append({
            "type": "vocab",
            "prompt_ar": w["ar"],
            "prompt_en": f"What does {w['tr']} mean?",
            "options": options,
            "answer": 0,
        })
    return quiz


def build(fetch_wbw: bool = True) -> dict:
    sources = json.loads((SRC / "sources.json").read_text())
    _attach_examples(VOCAB_LESSONS)

    lessons: dict[str, dict] = {}
    for lesson in VOCAB_LESSONS:
        payload = {**lesson, "type": "vocabulary", "quiz": _build_quiz_for_vocab(lesson)}
        lessons[lesson["id"]] = payload

    for lesson in GRAMMAR_LESSONS:
        lessons[lesson["id"]] = {**lesson, "type": "grammar"}

    for lesson in ROOT_LESSONS:
        lessons[lesson["id"]] = {**lesson, "type": "roots"}

    for lesson in READING_LESSONS:
        verses = []
        for vk in lesson["verse_keys"]:
            db_row = _ayah_from_db(vk)
            wbw = _fetch_verse_words(vk) if fetch_wbw else None
            if fetch_wbw:
                time.sleep(0.15)
            verses.append({
                "verse_key": vk,
                "arabic": (db_row or {}).get("arabic") or "",
                "translation_en": (db_row or {}).get("translation_en") or "",
                "translation_ur": (db_row or {}).get("translation_ur") or "",
                "words": (wbw or {}).get("words") or [],
            })
        lessons[lesson["id"]] = {**lesson, "type": "reading", "verses": verses}

    total_words = sum(len(l.get("words") or []) for l in VOCAB_LESSONS)
    meta = {
        "version": 1,
        "total_modules": len(MODULES),
        "total_lessons": len(lessons),
        "total_vocabulary": total_words,
        "target_coverage_pct": 82.6,
        "sources": sources,
    }

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "index.json").write_text(json.dumps({"modules": MODULES, "meta": meta}, ensure_ascii=False, indent=2))
    (OUT / "lessons.json").write_text(json.dumps(lessons, ensure_ascii=False))
    return meta


def main() -> None:
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--no-fetch", action="store_true", help="Skip Quran.com word-by-word fetch")
    args = parser.parse_args()
    meta = build(fetch_wbw=not args.no_fetch)
    print(f"Learn Quran course → {OUT}")
    print(f"  Modules: {meta['total_modules']}  Lessons: {meta['total_lessons']}  Words: {meta['total_vocabulary']}")


if __name__ == "__main__":
    main()
