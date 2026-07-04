#!/usr/bin/env python3
"""Build Learn Quran course JSON for web + Android WebView."""
from __future__ import annotations

import json
import random
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
    {
        "id": "vocab-11",
        "module_id": "m3-verbs",
        "order": 3,
        "title_en": "Present tense: says, knows, wills",
        "title_ur": "فعل مضارع: کہتا ہے، جانتا ہے",
        "title_hi": "वर्तमान काल: कहता है, जानता है",
        "coverage_pct": 66.0,
        "intro_en": "The Quran shifts to present tense for ongoing truths. Spot the يـ / تـ / نـ prefixes you learned in grammar.",
        "words": [
            {"ar": "يَقُولُ", "tr": "yaqūlu", "en": "he says", "ur": "وہ کہتا ہے", "hi": "वह कहता है", "freq": 332, "root": "ق و ل"},
            {"ar": "يَعْلَمُ", "tr": "yaʿlamu", "en": "he knows", "ur": "وہ جانتا ہے", "hi": "वह जानता है", "freq": 300, "root": "ع ل م"},
            {"ar": "يَعْمَلُونَ", "tr": "yaʿmalūna", "en": "they do; they work", "ur": "وہ کرتے ہیں", "hi": "वे करते हैं", "freq": 250, "root": "ع م ل"},
            {"ar": "يُؤْمِنُونَ", "tr": "yuʾminūna", "en": "they believe", "ur": "وہ ایمان رکھتے ہیں", "hi": "वे ईमान रखते हैं", "freq": 87, "root": "ء م ن"},
            {"ar": "يَرَىٰ", "tr": "yarā", "en": "he sees", "ur": "وہ دیکھتا ہے", "hi": "वह देखता है", "freq": 100, "root": "ر أ ي"},
            {"ar": "يَشَآءُ", "tr": "yashāʾu", "en": "He wills", "ur": "وہ چاہتا ہے", "hi": "वह चाहता है", "freq": 116, "root": "ش ي أ"},
            {"ar": "يَهْدِي", "tr": "yahdī", "en": "He guides", "ur": "وہ ہدایت دیتا ہے", "hi": "वह हिदायत देता है", "freq": 78, "root": "ه د ي"},
            {"ar": "يَدْعُو", "tr": "yadʿū", "en": "he calls; invokes", "ur": "وہ پکارتا ہے", "hi": "वह पुकारता है", "freq": 45, "root": "د ع و"},
            {"ar": "يَتَّقُونَ", "tr": "yattaqūna", "en": "they are mindful of Allah", "ur": "وہ تقویٰ اختیار کرتے ہیں", "hi": "वे तक़वा रखते हैं", "freq": 49, "root": "و ق ي"},
            {"ar": "يُنفِقُونَ", "tr": "yunfiqūna", "en": "they spend (in charity)", "ur": "وہ خرچ کرتے ہیں", "hi": "वे ख़र्च करते हैं", "freq": 33, "root": "ن ف ق"},
        ],
    },
    {
        "id": "vocab-12",
        "module_id": "m3-verbs",
        "order": 4,
        "title_en": "Enter, take, find — everyday verbs",
        "title_ur": "داخل ہونا، لینا، پانا",
        "title_hi": "दाख़िल होना, लेना, पाना",
        "coverage_pct": 69.0,
        "intro_en": "Narrative verbs that drive the stories of the prophets.",
        "words": [
            {"ar": "دَخَلَ", "tr": "dakhala", "en": "he entered", "ur": "وہ داخل ہوا", "hi": "वह दाख़िल हुआ", "freq": 79, "root": "د خ ل"},
            {"ar": "خَرَجَ", "tr": "kharaja", "en": "he went out", "ur": "وہ نکلا", "hi": "वह निकला", "freq": 61, "root": "خ ر ج"},
            {"ar": "أَخَذَ", "tr": "akhadha", "en": "he took; seized", "ur": "اس نے لیا", "hi": "उसने लिया", "freq": 127, "root": "أ خ ذ"},
            {"ar": "تَرَكَ", "tr": "taraka", "en": "he left (behind)", "ur": "اس نے چھوڑا", "hi": "उसने छोड़ा", "freq": 43, "root": "ت ر ك"},
            {"ar": "وَجَدَ", "tr": "wajada", "en": "he found", "ur": "اس نے پایا", "hi": "उसने पाया", "freq": 107, "root": "و ج د"},
            {"ar": "سَمِعَ", "tr": "samiʿa", "en": "he heard", "ur": "اس نے سنا", "hi": "उसने सुना", "freq": 100, "root": "س م ع"},
            {"ar": "رَأَىٰ", "tr": "raʾā", "en": "he saw", "ur": "اس نے دیکھا", "hi": "उसने देखा", "freq": 271, "root": "ر أ ي"},
            {"ar": "عَمِلَ", "tr": "ʿamila", "en": "he did; worked", "ur": "اس نے عمل کیا", "hi": "उसने अमल किया", "freq": 120, "root": "ع م ل"},
            {"ar": "كَسَبَ", "tr": "kasaba", "en": "he earned", "ur": "اس نے کمایا", "hi": "उसने कमाया", "freq": 62, "root": "ك س ب"},
            {"ar": "مَاتَ", "tr": "māta", "en": "he died", "ur": "وہ مر گیا", "hi": "वह मर गया", "freq": 80, "root": "م و ت"},
        ],
    },
    {
        "id": "vocab-13",
        "module_id": "m3-verbs",
        "order": 5,
        "title_en": "Give, command, ask, follow",
        "title_ur": "دینا، حکم دینا، مانگنا",
        "title_hi": "देना, हुक्म देना, माँगना",
        "coverage_pct": 72.0,
        "intro_en": "Verbs of giving, guidance and response — how Allah deals with His servants.",
        "words": [
            {"ar": "ءَاتَىٰ", "tr": "ātā", "en": "he gave", "ur": "اس نے دیا", "hi": "उसने दिया", "freq": 274, "root": "أ ت ي"},
            {"ar": "أَمَرَ", "tr": "amara", "en": "he commanded", "ur": "اس نے حکم دیا", "hi": "उसने हुक्म दिया", "freq": 77, "root": "أ م ر"},
            {"ar": "سَأَلَ", "tr": "saʾala", "en": "he asked", "ur": "اس نے پوچھا", "hi": "उसने पूछा", "freq": 120, "root": "س أ ل"},
            {"ar": "ٱسْتَجَابَ", "tr": "istajāba", "en": "he answered (a prayer)", "ur": "اس نے قبول کیا", "hi": "उसने क़बूल किया", "freq": 43, "root": "ج و ب"},
            {"ar": "وَعَدَ", "tr": "waʿada", "en": "he promised", "ur": "اس نے وعدہ کیا", "hi": "उसने वादा किया", "freq": 50, "root": "و ع د"},
            {"ar": "ٱتَّبَعَ", "tr": "ittabaʿa", "en": "he followed", "ur": "اس نے پیروی کی", "hi": "उसने पालन किया", "freq": 140, "root": "ت ب ع"},
            {"ar": "دَعَا", "tr": "daʿā", "en": "he called; prayed", "ur": "اس نے پکارا؛ دعا کی", "hi": "उसने पुकारा; दुआ की", "freq": 60, "root": "د ع و"},
            {"ar": "حَكَمَ", "tr": "ḥakama", "en": "he judged", "ur": "اس نے فیصلہ کیا", "hi": "उसने फ़ैसला किया", "freq": 45, "root": "ح ك م"},
            {"ar": "بَعَثَ", "tr": "baʿatha", "en": "he raised; sent forth", "ur": "اس نے اٹھایا؛ بھیجا", "hi": "उसने उठाया; भेजा", "freq": 65, "root": "ب ع ث"},
            {"ar": "رَزَقَ", "tr": "razaqa", "en": "he provided", "ur": "اس نے رزق دیا", "hi": "उसने रिज़्क़ दिया", "freq": 55, "root": "ر ز ق"},
        ],
    },
    {
        "id": "vocab-14",
        "module_id": "m1-core",
        "order": 7,
        "title_en": "Connectors: then, or, if, until",
        "title_ur": "حروف ربط: پھر، یا، اگر",
        "title_hi": "जोड़ने वाले शब्द: फिर, या, अगर",
        "coverage_pct": 75.0,
        "intro_en": "Small particles that structure every passage. Knowing these makes long ayahs suddenly readable.",
        "words": [
            {"ar": "ثُمَّ", "tr": "thumma", "en": "then; afterwards", "ur": "پھر", "hi": "फिर", "freq": 338},
            {"ar": "أَوْ", "tr": "aw", "en": "or", "ur": "یا", "hi": "या", "freq": 280},
            {"ar": "إِذَا", "tr": "idhā", "en": "when; whenever", "ur": "جب", "hi": "जब", "freq": 409},
            {"ar": "إِذْ", "tr": "idh", "en": "when (recalling the past)", "ur": "جب (ماضی)", "hi": "जब (अतीत)", "freq": 239},
            {"ar": "إِن", "tr": "in", "en": "if", "ur": "اگر", "hi": "अगर", "freq": 578},
            {"ar": "لَمْ", "tr": "lam", "en": "did not", "ur": "نہیں (ماضی کی نفی)", "hi": "नहीं (अतीत की नफ़ी)", "freq": 353},
            {"ar": "لَن", "tr": "lan", "en": "never will", "ur": "ہرگز نہیں", "hi": "कभी नहीं", "freq": 106},
            {"ar": "قَدْ", "tr": "qad", "en": "certainly; already", "ur": "تحقیق؛ یقیناً", "hi": "निश्चय; यक़ीनन", "freq": 406},
            {"ar": "بَلْ", "tr": "bal", "en": "rather; nay", "ur": "بلکہ", "hi": "बल्कि", "freq": 127},
            {"ar": "حَتَّىٰ", "tr": "ḥattā", "en": "until", "ur": "یہاں تک کہ", "hi": "यहाँ तक कि", "freq": 142},
            {"ar": "لَعَلَّ", "tr": "laʿalla", "en": "so that perhaps", "ur": "تاکہ شاید", "hi": "ताकि शायद", "freq": 129},
            {"ar": "سَوْفَ", "tr": "sawfa", "en": "will (in future)", "ur": "عنقریب", "hi": "जल्द ही", "freq": 42},
            {"ar": "كُلّ", "tr": "kull", "en": "every; all", "ur": "ہر؛ سب", "hi": "हर; सब", "freq": 358},
        ],
    },
    {
        "id": "vocab-15",
        "module_id": "m2-nouns",
        "order": 3,
        "title_en": "Creation & nature",
        "title_ur": "تخلیق اور فطرت",
        "title_hi": "सृष्टि और प्रकृति",
        "coverage_pct": 77.0,
        "intro_en": "The Quran constantly points to creation as signs (āyāt) of Allah.",
        "words": [
            {"ar": "شَمْس", "tr": "shams", "en": "sun", "ur": "سورج", "hi": "सूरज", "freq": 33},
            {"ar": "قَمَر", "tr": "qamar", "en": "moon", "ur": "چاند", "hi": "चाँद", "freq": 27},
            {"ar": "لَيْل", "tr": "layl", "en": "night", "ur": "رات", "hi": "रात", "freq": 92},
            {"ar": "نَهَار", "tr": "nahār", "en": "daytime", "ur": "دن", "hi": "दिन", "freq": 57},
            {"ar": "مَآء", "tr": "māʾ", "en": "water", "ur": "پانی", "hi": "पानी", "freq": 63},
            {"ar": "بَحْر", "tr": "baḥr", "en": "sea", "ur": "سمندر", "hi": "समुद्र", "freq": 41},
            {"ar": "جِبَال", "tr": "jibāl", "en": "mountains", "ur": "پہاڑ", "hi": "पहाड़", "freq": 39},
            {"ar": "شَجَرَة", "tr": "shajarah", "en": "tree", "ur": "درخت", "hi": "पेड़", "freq": 26},
            {"ar": "نُور", "tr": "nūr", "en": "light", "ur": "روشنی؛ نور", "hi": "रोशनी; नूर", "freq": 43},
            {"ar": "ظُلُمَٰت", "tr": "ẓulumāt", "en": "darknesses", "ur": "اندھیرے", "hi": "अंधेरे", "freq": 23},
            {"ar": "رِيح", "tr": "rīḥ", "en": "wind", "ur": "ہوا", "hi": "हवा", "freq": 29},
            {"ar": "نَجْم", "tr": "najm", "en": "star", "ur": "ستارہ", "hi": "तारा", "freq": 13},
        ],
    },
    {
        "id": "vocab-16",
        "module_id": "m2-nouns",
        "order": 4,
        "title_en": "Life, truth & the path",
        "title_ur": "زندگی، حق اور راستہ",
        "title_hi": "ज़िंदगी, हक़ और रास्ता",
        "coverage_pct": 79.5,
        "intro_en": "Abstract nouns at the heart of the Quran's message.",
        "words": [
            {"ar": "حَيَوٰة", "tr": "ḥayāh", "en": "life", "ur": "زندگی", "hi": "ज़िंदगी", "freq": 76},
            {"ar": "مَوْت", "tr": "mawt", "en": "death", "ur": "موت", "hi": "मौत", "freq": 50},
            {"ar": "رِزْق", "tr": "rizq", "en": "provision", "ur": "رزق", "hi": "रिज़्क़", "freq": 55},
            {"ar": "أَجْر", "tr": "ajr", "en": "reward", "ur": "اجر؛ بدلہ", "hi": "इनाम; बदला", "freq": 105},
            {"ar": "عَذَاب", "tr": "ʿadhāb", "en": "punishment", "ur": "عذاب", "hi": "अज़ाब", "freq": 322},
            {"ar": "ذَنۢب", "tr": "dhanb", "en": "sin", "ur": "گناہ", "hi": "गुनाह", "freq": 37},
            {"ar": "سَبِيل", "tr": "sabīl", "en": "way; path", "ur": "راستہ", "hi": "रास्ता", "freq": 176},
            {"ar": "حَقّ", "tr": "ḥaqq", "en": "truth; right", "ur": "حق", "hi": "हक़", "freq": 247},
            {"ar": "ءَايَة", "tr": "āyah", "en": "sign; verse", "ur": "نشانی؛ آیت", "hi": "निशानी; आयत", "freq": 86},
            {"ar": "أَمْر", "tr": "amr", "en": "command; affair", "ur": "حکم؛ معاملہ", "hi": "हुक्म; मामला", "freq": 166},
            {"ar": "فَضْل", "tr": "faḍl", "en": "bounty; grace", "ur": "فضل", "hi": "फ़ज़्ल", "freq": 84},
            {"ar": "قِيَٰمَة", "tr": "qiyāmah", "en": "resurrection", "ur": "قیامت", "hi": "क़यामत", "freq": 70},
        ],
    },
    {
        "id": "vocab-17",
        "module_id": "m2-nouns",
        "order": 5,
        "title_en": "Good, evil & the reckoning",
        "title_ur": "نیکی، برائی اور حساب",
        "title_hi": "नेकी, बुराई और हिसाब",
        "coverage_pct": 82.0,
        "intro_en": "The moral vocabulary of the Quran — deeds and their weighing.",
        "words": [
            {"ar": "خَيْر", "tr": "khayr", "en": "good; better", "ur": "بھلائی؛ بہتر", "hi": "भलाई; बेहतर", "freq": 186},
            {"ar": "شَرّ", "tr": "sharr", "en": "evil", "ur": "برائی؛ شر", "hi": "बुराई", "freq": 30},
            {"ar": "عَمَل", "tr": "ʿamal", "en": "deed; work", "ur": "عمل", "hi": "अमल", "freq": 71},
            {"ar": "صَٰلِحَٰت", "tr": "ṣāliḥāt", "en": "righteous deeds", "ur": "نیک اعمال", "hi": "नेक काम", "freq": 63},
            {"ar": "سَيِّئَة", "tr": "sayyiʾah", "en": "bad deed", "ur": "برائی؛ گناہ", "hi": "बुरा काम", "freq": 22},
            {"ar": "ذِكْر", "tr": "dhikr", "en": "remembrance", "ur": "ذکر؛ یاد", "hi": "ज़िक्र; याद", "freq": 76},
            {"ar": "صَبْر", "tr": "ṣabr", "en": "patience", "ur": "صبر", "hi": "सब्र", "freq": 103},
            {"ar": "غَيْب", "tr": "ghayb", "en": "the unseen", "ur": "غیب", "hi": "ग़ैब", "freq": 49},
            {"ar": "حِسَاب", "tr": "ḥisāb", "en": "reckoning; account", "ur": "حساب", "hi": "हिसाब", "freq": 39},
            {"ar": "جَزَآء", "tr": "jazāʾ", "en": "recompense", "ur": "بدلہ؛ جزا", "hi": "बदला", "freq": 42},
            {"ar": "تَقْوَىٰ", "tr": "taqwā", "en": "God-consciousness", "ur": "تقویٰ", "hi": "तक़वा", "freq": 17},
            {"ar": "دُعَآء", "tr": "duʿāʾ", "en": "supplication", "ur": "دعا", "hi": "दुआ", "freq": 20},
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
    {
        "id": "grammar-06",
        "module_id": "m4-grammar",
        "order": 6,
        "title_en": "Attached pronouns: my, your, His",
        "title_ur": "متصل ضمیریں: میرا، تیرا، اس کا",
        "title_hi": "जुड़े सर्वनाम: मेरा, तेरा, उसका",
        "intro_en": "Arabic attaches pronouns to the end of words. One suffix turns رَبّ (Lord) into رَبُّكَ (your Lord) — this happens in almost every ayah.",
        "sections": [
            {
                "heading_en": "The suffix set",
                "body_en": "ـهُ his · ـهَا her · ـهُمْ their · ـكَ your (m) · ـكُمْ your (pl) · ـنَا our · ـِي my. They attach to nouns (possession), verbs (object) and prepositions.",
                "examples": [
                    {"ar": "رَبُّكَ", "en": "your Lord", "note": "رَبّ + كَ"},
                    {"ar": "رَبَّنَا", "en": "our Lord", "note": "the du'a opener — رَبّ + نَا"},
                    {"ar": "قُلُوبُهُمْ", "en": "their hearts", "note": "قُلُوب + هُمْ"},
                ],
            },
            {
                "heading_en": "On verbs and prepositions",
                "body_en": "خَلَقَكُمْ = He created you. لَكُمْ = for you. فِيهَا = in it. عَلَيْهِمْ = upon them.",
                "examples": [
                    {"ar": "خَلَقَكُمْ", "en": "He created you (pl)", "note": "خَلَقَ + كُمْ"},
                    {"ar": "لَكُمْ دِينُكُمْ وَلِيَ دِينِ", "en": "For you is your religion, and for me is my religion", "note": "109:6 — four pronouns in one ayah"},
                ],
            },
        ],
        "practice": [
            {"q_en": "رَبُّنَا means?", "options": ["our Lord", "your Lord", "their Lord"], "answer": 0},
            {"q_en": "In قُلُوبُهُمْ, the ـهُمْ means?", "options": ["their", "our", "my"], "answer": 0},
        ],
    },
    {
        "id": "grammar-07",
        "module_id": "m4-grammar",
        "order": 7,
        "title_en": "Possession: the iḍāfah",
        "title_ur": "اضافت",
        "title_hi": "इज़ाफ़त (संबंध)",
        "intro_en": "Two nouns side by side = 'X of Y'. رَسُولُ اللَّهِ = Messenger of Allah. The first noun never takes ال; the second is genitive.",
        "sections": [
            {
                "heading_en": "The pattern",
                "body_en": "رَبِّ ٱلْعَٰلَمِينَ = Lord of the worlds. يَوْمِ ٱلدِّينِ = Day of Judgement. أَهْلِ ٱلْكِتَٰبِ = People of the Book. Notice: first word has no ال, second word ends in kasra.",
                "examples": [
                    {"ar": "رَبِّ ٱلْعَٰلَمِينَ", "en": "Lord of the worlds", "note": "1:2"},
                    {"ar": "مَٰلِكِ يَوْمِ ٱلدِّينِ", "en": "Master of the Day of Judgement", "note": "a chain: Master → of Day → of Judgement"},
                    {"ar": "أَصْحَٰبُ ٱلْجَنَّةِ", "en": "companions of Paradise", "note": ""},
                ],
            },
        ],
        "practice": [
            {"q_en": "كِتَٰبُ اللَّهِ means?", "options": ["the Book of Allah", "Allah is a book", "the written Allah"], "answer": 0},
            {"q_en": "In an iḍāfah, the FIRST noun…", "options": ["never takes ال", "always takes ال", "must be a verb"], "answer": 0},
        ],
    },
    {
        "id": "grammar-08",
        "module_id": "m4-grammar",
        "order": 8,
        "title_en": "Present tense (فعل مضارع)",
        "title_ur": "فعل مضارع",
        "title_hi": "फ़ेल मुज़ारे (वर्तमान)",
        "intro_en": "Present/future verbs start with أ / ن / ي / ت: I / we / he / you-she. Recognize the prefix and you instantly know who acts.",
        "sections": [
            {
                "heading_en": "The four prefixes",
                "body_en": "أَعْبُدُ I worship · نَعْبُدُ we worship · يَعْبُدُ he worships · تَعْبُدُ you worship (or she worships). Plural adds ونَ: يَعْلَمُونَ they know.",
                "examples": [
                    {"ar": "إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ", "en": "You alone we worship, and You alone we ask for help", "note": "1:5 — both verbs start with نـ (we)"},
                    {"ar": "قُلْ أَعُوذُ بِرَبِّ ٱلنَّاسِ", "en": "Say: I seek refuge in the Lord of mankind", "note": "أَعُوذُ starts with أ (I)"},
                ],
            },
        ],
        "practice": [
            {"q_en": "نَعْلَمُ means?", "options": ["we know", "I know", "they know"], "answer": 0},
            {"q_en": "A verb starting يَـ is done by?", "options": ["he / they", "I", "we"], "answer": 0},
        ],
    },
    {
        "id": "grammar-09",
        "module_id": "m4-grammar",
        "order": 9,
        "title_en": "Negation: لا، ما، لم، لن",
        "title_ur": "نفی: لا، ما، لم، لن",
        "title_hi": "नफ़ी: ला, मा, लम, लन",
        "intro_en": "Four ways to say 'not', each with its own time: لا (present/general), مَا (past), لَمْ (did not), لَنْ (never will).",
        "sections": [
            {
                "heading_en": "Each particle's job",
                "body_en": "لَا يَعْلَمُونَ they do not know · مَا كَانَ he was not · لَمْ يَلِدْ He did not beget · لَنْ تَنَالُوا you will never attain.",
                "examples": [
                    {"ar": "لَمْ يَلِدْ وَلَمْ يُولَدْ", "en": "He neither begets nor was born", "note": "112:3 — لَمْ + present form = past negation"},
                    {"ar": "وَلَا ٱلضَّآلِّينَ", "en": "nor of those who are astray", "note": "1:7"},
                    {"ar": "لَن تَنَالُوا۟ ٱلْبِرَّ حَتَّىٰ تُنفِقُوا۟", "en": "You will never attain righteousness until you spend", "note": "3:92"},
                ],
            },
        ],
        "practice": [
            {"q_en": "لَنْ negates the…", "options": ["future (never will)", "past", "a noun"], "answer": 0},
            {"q_en": "لَمْ يَعْلَمْ means?", "options": ["he did not know", "he will not know", "he knows"], "answer": 0},
        ],
    },
    {
        "id": "grammar-10",
        "module_id": "m4-grammar",
        "order": 10,
        "title_en": "Commands & prohibitions",
        "title_ur": "امر اور نہی",
        "title_hi": "आदेश और निषेध",
        "intro_en": "قُلْ (Say!) opens dozens of surahs. Commands (أمر) drop the prefix; prohibitions use لَا + present verb.",
        "sections": [
            {
                "heading_en": "Commands",
                "body_en": "قُلْ say! · ٱعْبُدُوا worship! · ٱتَّقُوا be mindful! · ٱهْدِنَا guide us! — plural commands end in وا.",
                "examples": [
                    {"ar": "قُلْ هُوَ ٱللَّهُ أَحَدٌ", "en": "Say: He is Allah, the One", "note": "112:1"},
                    {"ar": "ٱهْدِنَا ٱلصِّرَٰطَ ٱلْمُسْتَقِيمَ", "en": "Guide us to the straight path", "note": "1:6 — command + نا (us)"},
                ],
            },
            {
                "heading_en": "Prohibitions (لَا الناهية)",
                "body_en": "لَا تَحْزَنْ do not grieve · لَا تَقْرَبُوا do not approach · لَا تَقْنَطُوا do not despair.",
                "examples": [
                    {"ar": "لَا تَحْزَنْ إِنَّ ٱللَّهَ مَعَنَا", "en": "Do not grieve; indeed Allah is with us", "note": "9:40"},
                ],
            },
        ],
        "practice": [
            {"q_en": "ٱعْبُدُوا means?", "options": ["worship! (you all)", "he worshipped", "we worship"], "answer": 0},
            {"q_en": "لَا تَخَفْ means?", "options": ["do not fear", "he does not fear", "they feared"], "answer": 0},
        ],
    },
    {
        "id": "grammar-11",
        "module_id": "m4-grammar",
        "order": 11,
        "title_en": "Plurals & duals",
        "title_ur": "جمع اور تثنیہ",
        "title_hi": "बहुवचन और द्विवचन",
        "intro_en": "Sound plurals add ونَ/ينَ (m) or ات (f); Arabic also has a dual for exactly two. Many key Quran words are broken plurals to memorize.",
        "sections": [
            {
                "heading_en": "Sound plurals",
                "body_en": "مُسْلِمُونَ / مُسْلِمِينَ Muslims (m) · مُسْلِمَٰت Muslim women · مُؤْمِنُونَ believers. The ون/ين ending depends on grammatical case.",
                "examples": [
                    {"ar": "قَدْ أَفْلَحَ ٱلْمُؤْمِنُونَ", "en": "Successful indeed are the believers", "note": "23:1"},
                ],
            },
            {
                "heading_en": "Broken plurals & dual",
                "body_en": "كِتَٰب → كُتُب books · رَسُول → رُسُل messengers · قَلْب → قُلُوب hearts. Dual: ـَانِ / ـَيْنِ = exactly two: جَنَّتَانِ two gardens (55:46).",
                "examples": [
                    {"ar": "وَلِمَنْ خَافَ مَقَامَ رَبِّهِۦ جَنَّتَانِ", "en": "For whoever fears standing before his Lord are two gardens", "note": "55:46 — dual"},
                ],
            },
        ],
        "practice": [
            {"q_en": "قُلُوب is the plural of?", "options": ["قَلْب (heart)", "كِتَاب (book)", "رَسُول (messenger)"], "answer": 0},
            {"q_en": "The ending ـَانِ signals?", "options": ["exactly two (dual)", "feminine", "past tense"], "answer": 0},
        ],
    },
    {
        "id": "grammar-12",
        "module_id": "m4-grammar",
        "order": 12,
        "title_en": "Word patterns: doer & done",
        "title_ur": "اوزان: فاعل اور مفعول",
        "title_hi": "पैटर्न: करने वाला और किया हुआ",
        "intro_en": "Arabic molds roots into patterns (أوزان). فَاعِل = the doer, مَفْعُول = the one done to. Recognize the pattern, guess the meaning.",
        "sections": [
            {
                "heading_en": "فَاعِل — the doer",
                "body_en": "كَافِر one who disbelieves · ظَالِم wrongdoer · عَابِد worshipper · صَادِق truthful one. From any root, this pattern names who does the action.",
                "examples": [
                    {"ar": "وَٱللَّهُ عَلِيمٌ بِٱلظَّٰلِمِينَ", "en": "And Allah is fully aware of the wrongdoers", "note": "ظَالِمِين = plural of ظَالِم"},
                ],
            },
            {
                "heading_en": "مَفْعُول and the مُـ patterns",
                "body_en": "مَفْعُول = done: مَكْتُوب written. Longer verb forms use مُـ: مُسْلِم (one who submits), مُؤْمِن (one who believes), مُتَّقِين (those mindful of Allah).",
                "examples": [
                    {"ar": "هُدًى لِّلْمُتَّقِينَ", "en": "a guidance for the God-conscious", "note": "2:2 — مُتَّقِين from root و ق ي"},
                ],
            },
        ],
        "practice": [
            {"q_en": "The pattern فَاعِل tells you the word is?", "options": ["the doer of the action", "the place of the action", "the past tense"], "answer": 0},
            {"q_en": "مُؤْمِن means?", "options": ["one who believes", "belief", "he believed"], "answer": 0},
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
    {
        "id": "roots-04",
        "module_id": "m5-roots",
        "order": 4,
        "title_en": "Root ع-ب-د (worship)",
        "title_ur": "جذر ع-ب-د",
        "title_hi": "जड़ अ-ब-द",
        "intro_en": "The purpose of creation — one root covers the servant, the worship, and the worshipped.",
        "roots": [
            {"root": "ع ب د", "words": [
                {"ar": "عَبَدَ", "en": "he worshipped"},
                {"ar": "عَبْد", "en": "servant; slave"},
                {"ar": "عِبَاد", "en": "servants"},
                {"ar": "عَابِد", "en": "worshipper"},
                {"ar": "نَعْبُدُ", "en": "we worship"},
            ]},
        ],
        "practice_ayah": "51:56",
    },
    {
        "id": "roots-05",
        "module_id": "m5-roots",
        "order": 5,
        "title_en": "Root س-ل-م (peace & submission)",
        "title_ur": "جذر س-ل-م",
        "title_hi": "जड़ स-ल-म",
        "intro_en": "Islam, Muslim, salam — the religion's own name comes from this root of peace and surrender.",
        "roots": [
            {"root": "س ل م", "words": [
                {"ar": "سَلَٰم", "en": "peace"},
                {"ar": "إِسْلَٰم", "en": "Islam; submission"},
                {"ar": "مُسْلِم", "en": "one who submits"},
                {"ar": "أَسْلَمَ", "en": "he submitted"},
                {"ar": "سَلِيم", "en": "sound; unblemished (heart)"},
            ]},
        ],
        "practice_ayah": "26:89",
    },
    {
        "id": "roots-06",
        "module_id": "m5-roots",
        "order": 6,
        "title_en": "Root ه-د-ي (guidance)",
        "title_ur": "جذر ه-د-ي",
        "title_hi": "जड़ ह-द-य",
        "intro_en": "From the du'a you make seventeen times a day in salah: guide us.",
        "roots": [
            {"root": "ه د ي", "words": [
                {"ar": "هَدَىٰ", "en": "he guided"},
                {"ar": "هُدًى", "en": "guidance"},
                {"ar": "يَهْدِي", "en": "He guides"},
                {"ar": "ٱهْدِنَا", "en": "guide us!"},
                {"ar": "مُهْتَدُونَ", "en": "the rightly guided"},
            ]},
        ],
        "practice_ayah": "1:6",
    },
]

READING_LESSONS: list[dict] = [
    {"id": "read-01", "module_id": "m6-reading", "order": 1, "title_en": "Al-Fatiha — word by word", "title_ur": "الفاتحہ — لفظ بہ لفظ", "title_hi": "अल-फातिहा — शब्द दर शब्द", "verse_keys": ["1:1", "1:2", "1:3", "1:4", "1:5", "1:6", "1:7"], "hide_translation_after": 3},
    {"id": "read-02", "module_id": "m6-reading", "order": 2, "title_en": "Surah Al-Ikhlas", "title_ur": "سورہ اخلاص", "title_hi": "सूरह इख़लास", "verse_keys": ["112:1", "112:2", "112:3", "112:4"], "hide_translation_after": 2},
    {"id": "read-03", "module_id": "m6-reading", "order": 3, "title_en": "Surah Al-Falaq", "title_ur": "سورہ فلق", "title_hi": "सूरह फ़लक़", "verse_keys": ["113:1", "113:2", "113:3", "113:4", "113:5"], "hide_translation_after": 2},
    {"id": "read-04", "module_id": "m6-reading", "order": 4, "title_en": "Surah An-Nas", "title_ur": "سورہ ناس", "title_hi": "सूरह नास", "verse_keys": ["114:1", "114:2", "114:3", "114:4", "114:5", "114:6"], "hide_translation_after": 2},
    {"id": "read-05", "module_id": "m6-reading", "order": 5, "title_en": "Ayat al-Kursi (2:255)", "title_ur": "آیت الکرسی", "title_hi": "आयतुल कुर्सी", "verse_keys": ["2:255"], "hide_translation_after": 0},
    {"id": "read-06", "module_id": "m6-reading", "order": 6, "title_en": "Last verses of Al-Baqarah", "title_ur": "آخر البقرہ", "title_hi": "अल-बक़रा की आख़िरी आयतें", "verse_keys": ["2:285", "2:286"], "hide_translation_after": 1},
    {"id": "read-07", "module_id": "m6-reading", "order": 7, "title_en": "Surah Al-Asr", "title_ur": "سورہ عصر", "title_hi": "सूरह अस्र", "verse_keys": ["103:1", "103:2", "103:3"], "hide_translation_after": 1},
    {"id": "read-08", "module_id": "m6-reading", "order": 8, "title_en": "Surah Al-Kawthar", "title_ur": "سورہ کوثر", "title_hi": "सूरह कौसर", "verse_keys": ["108:1", "108:2", "108:3"], "hide_translation_after": 1},
    {"id": "read-09", "module_id": "m6-reading", "order": 9, "title_en": "Surah Al-Kafirun", "title_ur": "سورہ کافرون", "title_hi": "सूरह काफ़िरून", "verse_keys": ["109:1", "109:2", "109:3", "109:4", "109:5", "109:6"], "hide_translation_after": 2},
    {"id": "read-10", "module_id": "m6-reading", "order": 10, "title_en": "Surah An-Nasr", "title_ur": "سورہ نصر", "title_hi": "सूरह नस्र", "verse_keys": ["110:1", "110:2", "110:3"], "hide_translation_after": 1},
    {"id": "read-11", "module_id": "m6-reading", "order": 11, "title_en": "Surah Al-Fil", "title_ur": "سورہ فیل", "title_hi": "सूरह फ़ील", "verse_keys": ["105:1", "105:2", "105:3", "105:4", "105:5"], "hide_translation_after": 2},
    {"id": "read-12", "module_id": "m6-reading", "order": 12, "title_en": "Surah Quraysh", "title_ur": "سورہ قریش", "title_hi": "सूरह क़ुरैश", "verse_keys": ["106:1", "106:2", "106:3", "106:4"], "hide_translation_after": 1},
    {"id": "read-13", "module_id": "m6-reading", "order": 13, "title_en": "Surah Al-Ma'un", "title_ur": "سورہ ماعون", "title_hi": "सूरह माऊन", "verse_keys": ["107:1", "107:2", "107:3", "107:4", "107:5", "107:6", "107:7"], "hide_translation_after": 2},
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
    """Find up to 2 ayahs containing each vocab word.

    Matching must happen on diacritic-stripped text on BOTH sides — the DB
    ayahs keep full harakat, so a LIKE against the stripped word never hits.
    """
    if not DB.exists():
        return
    conn = sqlite3.connect(DB)
    cur = conn.cursor()
    cur.execute("SELECT verse_key, arabic FROM ayahs")
    ayahs = [(vk, ar, f" {_norm_arabic(ar)} ") for vk, ar in cur.fetchall()]
    conn.close()

    for lesson in lessons:
        for word in lesson.get("words") or []:
            ar = _norm_arabic(word["ar"])
            if not ar:
                continue
            examples = []
            # Prefer whole-word hits; the ٱ/ا variants both occur in ayahs.
            needles = {f" {ar} ", f" ٱل{ar} ", f" ال{ar} ", f" و{ar} "}
            for vk, original, norm in ayahs:
                if any(n in norm for n in needles):
                    examples.append({"verse_key": vk, "snippet": original[:120]})
                    if len(examples) == 2:
                        break
            if not examples:  # fall back to substring (prefixed/suffixed forms)
                for vk, original, norm in ayahs:
                    if ar in norm:
                        examples.append({"verse_key": vk, "snippet": original[:120]})
                        if len(examples) == 2:
                            break
            word["examples"] = examples


def _build_quiz_for_vocab(lesson: dict) -> list[dict]:
    words = lesson.get("words") or []
    quiz = []
    for i, w in enumerate(words[:8]):
        rnd = random.Random(f"{lesson['id']}:{w['ar']}")
        others = [x["en"] for j, x in enumerate(words) if j != i and x["en"] != w["en"]]
        rnd.shuffle(others)
        options = [w["en"]] + others[:3]
        if len(options) < 4:
            options.extend(x for x in ("and", "the", "in") if x not in options)
        options = list(dict.fromkeys(options))[:4]
        rnd.shuffle(options)
        quiz.append({
            "type": "vocab",
            "prompt_ar": w["ar"],
            "prompt_en": f"What does {w['tr']} mean?",
            "options": options,
            "answer": options.index(w["en"]),
        })
    return quiz


def _shuffle_practice(lesson: dict) -> None:
    """Hand-written practice lists the correct option first; shuffle it away."""
    for q in lesson.get("practice") or []:
        rnd = random.Random(f"{lesson['id']}:{q['q_en']}")
        correct = q["options"][q["answer"]]
        options = list(q["options"])
        rnd.shuffle(options)
        q["options"] = options
        q["answer"] = options.index(correct)


def build(fetch_wbw: bool = True) -> dict:
    sources = json.loads((SRC / "sources.json").read_text())
    _attach_examples(VOCAB_LESSONS)

    lessons: dict[str, dict] = {}
    for lesson in VOCAB_LESSONS:
        payload = {**lesson, "type": "vocabulary", "quiz": _build_quiz_for_vocab(lesson)}
        lessons[lesson["id"]] = payload

    for lesson in GRAMMAR_LESSONS:
        payload = {**lesson, "type": "grammar", "practice": [dict(q) for q in lesson["practice"]]}
        _shuffle_practice(payload)
        lessons[lesson["id"]] = payload

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
