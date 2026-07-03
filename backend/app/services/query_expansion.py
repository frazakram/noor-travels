"""Dynamic query expansion and intent routing — not per-question hardcoding."""
import re
from typing import Any

# Thematic clusters: pattern → search terms, dua DB categories, curated Quran verses
# Higher priority wins when multiple themes match (specific beats generic).
THEMATIC_CLUSTERS: list[dict[str, Any]] = [
    {
        "id": "fitrah",
        "priority": 90,
        "pattern": r"fitr|fitrah|fitrana|zakat\s*ul?\s*fitr|sadaqat\s*ul?\s*fitr|فطرہ|فطر|फ़ितर|फितरा",
        "terms": ["fitr", "fitrah", "zakat", "charity", "dates", "barley", "eid", "poor", "ramadan"],
        "dua_categories": [],
        "verse_keys": ["2:267", "9:60"],
        "hadith_refs": ["Sahih al-Bukhari 1451", "Sahih al-Bukhari 1452", "Sahih al-Bukhari 1453"],
    },
    {
        "id": "zakat_general",
        "priority": 87,
        "pattern": (
            r"what\s+is\s+zakat|what\s+is\s+zakah|define\s+zakat|meaning\s+of\s+zakat|"
            r"zakat\s+mean|explain\s+zakat|زکوٰة\s+کیا|ज़कात\s+क्या"
        ),
        "terms": ["zakat", "zakah", "charity", "wealth", "poor", "obligation", "pillar", "purify"],
        "dua_categories": [],
        "verse_keys": ["9:60", "2:267", "2:110", "2:43"],
        "hadith_refs": ["Sahih al-Bukhari 1405"],
    },
    {
        "id": "zakat_rate",
        "priority": 85,
        "pattern": (
            r"zakat|zakah|"
            r"(?:percentage|percent|how\s+much).{0,40}(?:wealth|money|spend|pay)|"
            r"(?:wealth|money).{0,40}(?:percentage|percent|spend|pay|zakat)|"
            r"fortieth|2\.5\s*%|one.fortieth|nisab"
        ),
        "terms": ["zakat", "charity", "wealth", "fortieth", "poor", "spend", "silver", "gold", "obligation"],
        "dua_categories": [],
        "verse_keys": ["9:60", "2:267"],
        "hadith_refs": ["Sahih al-Bukhari 1405"],
    },
    {
        "id": "study",
        "priority": 50,
        "pattern": r"exam|test|stud(y|ies)|school|college|university|result|marks|memory",
        "terms": ["knowledge", "learn", "teach", "wisdom", "easy", "difficulty", "understand", "success", "grant"],
        "dua_categories": ["study", "knowledge", "exam"],
        "verse_keys": ["20:114", "26:83", "3:8"],
    },
    {
        "id": "travel",
        "priority": 50,
        "pattern": r"travel|journey|safar|سفر|trip|flight|vehicle|mounting",
        "terms": ["travel", "journey", "safety", "vehicle", "leaving", "home", "return"],
        "dua_categories": ["travel"],
        "verse_keys": [],
    },
    {
        "id": "patience",
        "priority": 50,
        "pattern": r"patien|sabr|صبر|सब्र|hardship|difficult",
        "terms": ["patient", "patience", "steadfast", "persevere", "trial", "hardship", "ease"],
        "dua_categories": ["patience"],
        "verse_keys": ["2:153", "2:155", "3:200"],
        "hadith_refs": ["Sahih al-Bukhari 1260"],
    },
    {
        "id": "purpose",
        "priority": 50,
        "pattern": r"purpose|meaning of life|why.*(exist|created|human)",
        "terms": ["worship", "created", "mankind", "test", "deeds", "aimlessly"],
        "dua_categories": [],
        "verse_keys": ["51:56", "2:30", "23:115"],
    },
    {
        "id": "marriage",
        "priority": 50,
        "pattern": r"marriage|wedding|nikah|نکاح|shadi|शादी",
        "terms": ["marriage", "spouse", "wife", "husband", "mercy", "tranquillity"],
        "dua_categories": ["marriage"],
        "verse_keys": ["30:21", "25:74"],
        "hadith_refs": ["Sahih al-Bukhari 5063"],
    },
    {
        "id": "death",
        "priority": 50,
        "pattern": r"death|dying|grave|janaz|funeral|موت",
        "terms": ["death", "grave", "hereafter", "mercy", "forgive"],
        "dua_categories": ["death"],
        "verse_keys": ["2:156", "3:185"],
        "hadith_refs": ["Sahih al-Bukhari 18", "Sahih al-Bukhari 1260"],
    },
    {
        "id": "forgiveness",
        "priority": 50,
        "pattern": r"forgive|mercy|repent|tawbah|توبہ",
        "terms": ["forgive", "mercy", "repent", "sin", "pardon"],
        "dua_categories": ["forgiveness"],
        "verse_keys": ["39:53", "2:286"],
        "hadith_refs": ["Sahih al-Bukhari 6306"],
    },
    {
        "id": "rizq",
        "priority": 20,
        "pattern": r"rizq|sustenance|provision|job|wealth|money|poverty",
        "terms": ["provision", "sustenance", "wealth", "poor", "charity", "rizq"],
        "dua_categories": ["rizq"],
        "verse_keys": ["2:201", "28:24"],
    },
    {
        "id": "health",
        "priority": 50,
        "pattern": r"health|sick|illness|heal|شفا",
        "terms": ["heal", "health", "sick", "cure", "mercy"],
        "dua_categories": ["health"],
        "verse_keys": ["26:80", "41:44"],
        "hadith_refs": ["Sahih al-Bukhari 233"],
    },
    {
        "id": "anxiety",
        "priority": 50,
        "pattern": r"anxiety|worry|stress|fear|afraid|غم",
        "terms": ["anxiety", "fear", "grief", "ease", "peace", "trust", "heart"],
        "dua_categories": ["anxiety"],
        "verse_keys": ["13:28", "94:5"],
    },
    {
        "id": "parents",
        "priority": 50,
        "pattern": r"parent|mother|father|والدین",
        "terms": ["parent", "mother", "father", "kindness", "mercy"],
        "dua_categories": [],
        "verse_keys": ["17:23", "31:14"],
        "hadith_refs": ["Sahih al-Bukhari 5971"],
    },
    {
        "id": "sleep",
        "priority": 50,
        "pattern": r"sleep|bedtime|before\s+sleep|going\s+to\s+bed|bed\s*time|at\s+night|سونے|نیند|सोने|सोना",
        "terms": [
            "mulk", "ikhlas", "falaq", "nas", "kursi", "sleep", "bed", "night",
            "recite", "read", "protect", "grave", "blow", "palms",
        ],
        "dua_categories": ["sleep"],
        "verse_keys": ["67:1", "2:255", "112:1", "113:1", "114:1"],
        "hadith_refs": ["Sahih al-Bukhari 5526", "Sahih al-Bukhari 247"],
    },
    {
        "id": "salah",
        "priority": 50,
        "pattern": r"salah|salat|namaz|نماز|नमाज|prayer\s*time|five\s+prayer",
        "terms": ["prayer", "salah", "establish", "mosque", "congregation", "wudu"],
        "dua_categories": [],
        "verse_keys": ["2:238", "29:45", "20:14"],
        "hadith_refs": [],
    },
    {
        "id": "asr_madhab",
        "priority": 52,
        "pattern": r"asr|hanafi|shafi|shadow.{0,20}length|madhab|مذہب",
        "terms": ["Asr", "afternoon", "shadow", "length", "Hanafi", "Shafi", "prayer time"],
        "dua_categories": [],
        "verse_keys": ["2:238"],
        "hadith_refs": ["Sahih al-Bukhari 46"],
    },
    {
        "id": "ramadan",
        "priority": 30,
        "pattern": r"ramadan|ramzan|fasting|fast\b|roza|روزہ|रोज़ा|iftar|suhoor",
        "terms": ["fast", "fasting", "ramadan", "month", "break", "poor", "taqwa"],
        "dua_categories": [],
        "verse_keys": ["2:183", "2:185", "2:187"],
        "hadith_refs": ["Sahih al-Bukhari 1899"],
    },
    {
        "id": "hajj",
        "priority": 50,
        "pattern": r"hajj|haj|umrah|عمرہ|حج|हज",
        "terms": ["hajj", "pilgrimage", "kaaba", "arafat", "tawaf", "ihram"],
        "dua_categories": [],
        "verse_keys": ["2:196", "3:97", "22:27"],
        "hadith_refs": ["Sahih al-Bukhari 1519"],
    },
    {
        "id": "alcohol",
        "priority": 55,
        "pattern": r"alcohol|wine|beer|intoxicant|khamr|شراب|शराब|drunk",
        "terms": ["wine", "intoxicant", "alcohol", "forbidden", "avoid", "drink"],
        "dua_categories": [],
        "verse_keys": ["2:219", "5:90", "4:43"],
        "hadith_refs": ["Sahih al-Bukhari 242"],
    },
    {
        "id": "allahu_akbar",
        "priority": 60,
        "pattern": r"allahu\s+akbar|takbir|takbeer|الله\s+اکبر",
        "terms": ["Allah", "great", "Akbar", "magnificent", "praise"],
        "dua_categories": [],
        "verse_keys": ["37:102", "17:111"],
        "hadith_refs": ["Sahih al-Bukhari 340"],
    },
    {
        "id": "makruh_haram",
        "priority": 55,
        "pattern": r"makruh|makrooh|disliked|haram\s+and|difference.{0,20}haram",
        "terms": ["forbidden", "disliked", "haram", "makruh", "sin", "lawful"],
        "dua_categories": [],
        "verse_keys": ["2:173", "5:3", "6:145"],
        "hadith_refs": ["Sahih al-Bukhari 52"],
    },
    {
        "id": "wudu_conditions",
        "priority": 55,
        "pattern": r"valid\s+wudu|conditions?.{0,15}wudu|wudu.{0,20}valid|ablution.{0,20}condition",
        "terms": ["wudu", "ablution", "purify", "wash", "valid", "prayer"],
        "dua_categories": [],
        "verse_keys": ["5:6", "4:43"],
        "hadith_refs": ["Sahih al-Bukhari 135"],
    },
    {
        "id": "jannah",
        "priority": 50,
        "pattern": r"jannah|paradise|heaven|جنہ|جنت|स्वर्ग",
        "terms": ["Paradise", "Jannah", "heaven", "reward", "garden", "believers"],
        "dua_categories": [],
        "verse_keys": ["3:133", "9:72", "18:31"],
        "hadith_refs": ["Sahih al-Bukhari 22"],
    },
    {
        "id": "truthfulness",
        "priority": 52,
        "pattern": r"ly(?:ing|e)|liar|truthful|honest|truth\b|جھوٹ|झूठ",
        "terms": ["truth", "honest", "lie", "lying", "trustworthy", "falsehood"],
        "dua_categories": [],
        "verse_keys": ["9:119", "33:35"],
        "hadith_refs": ["Sahih al-Bukhari 319"],
    },
    {
        "id": "eating_etiquette",
        "priority": 52,
        "pattern": r"etiquette.{0,20}eat|eating.{0,20}islam|bismillah.{0,20}eat|manners?.{0,15}food",
        "terms": ["eat", "Bismillah", "right hand", "food", "manners", "table"],
        "dua_categories": [],
        "verse_keys": ["2:168", "7:31"],
        "hadith_refs": ["Sahih al-Bukhari 3"],
    },
    {
        "id": "business_honesty",
        "priority": 52,
        "pattern": r"honest.{0,20}business|business.{0,20}honest|trade.{0,20}honest|honesty.{0,15}trade",
        "terms": ["honest", "trade", "business", "cheat", "measure", "fair"],
        "dua_categories": [],
        "verse_keys": ["83:1", "55:9", "17:35"],
        "hadith_refs": ["Sahih al-Bukhari 33"],
    },
    {
        "id": "rain_dua",
        "priority": 48,
        "pattern": r"rain|istisqa|drought|barish|بارش|बारिश",
        "terms": ["rain", "istisqa", "drought", "prayer", "supplication", "water"],
        "dua_categories": ["travel"],
        "verse_keys": ["30:48", "25:48"],
        "hadith_refs": ["Sahih al-Bukhari 978"],
    },
    {
        "id": "charity",
        "priority": 40,
        "pattern": r"zakat|zakah|charity|sadaq|صدقہ|दान|poor|needy",
        "terms": ["charity", "zakat", "poor", "needy", "spend", "wealth"],
        "dua_categories": [],
        "verse_keys": ["2:267", "9:60", "57:7"],
        "hadith_refs": ["Sahih al-Bukhari 1419"],
    },
    {
        "id": "scripture",
        "priority": 58,
        "pattern": r"bible|gospel|torah|injil|tawrat|people of the book|scripture|انجیل|تورات",
        "terms": ["Torah", "Gospel", "revealed", "Scripture", "Book", "Injil", "Tawrat"],
        "dua_categories": [],
        "verse_keys": ["3:3", "5:46", "5:68", "2:97", "6:154"],
        "hadith_refs": [],
    },
    {
        "id": "science_knowledge",
        "priority": 55,
        "pattern": r"science|scientific|knowledge|reflect.{0,20}creation|signs?.{0,15}(?:heaven|earth|creation)",
        "terms": ["sign", "reflect", "knowledge", "creation", "heavens", "earth", "ponder"],
        "dua_categories": [],
        "verse_keys": ["41:53", "3:190", "16:12", "2:164", "30:22"],
        "hadith_refs": [],
    },
    {
        "id": "neighbors",
        "priority": 50,
        "pattern": r"neighbor|neighbour|پڑوس|पड़ोस",
        "terms": ["neighbor", "neighbour", "rights", "kindness", "harm"],
        "dua_categories": [],
        "verse_keys": ["4:36", "49:10"],
        "hadith_refs": ["Sahih al-Bukhari 6014"],
    },
    {
        "id": "jihad",
        "priority": 75,
        "pattern": (
            r"jihad|jihaad|qital|قتال|جہاد|جهاد|kill(?:ing)?.{0,30}quran|"
            r"(?:quran|islam).{0,40}(?:kill|fight|war|violence|sword)|"
            r"(?:kill|fight|war|violence).{0,40}(?:quran|islam|surah)|"
            r"why.{0,30}(?:kill|fight|war)|context.{0,30}(?:kill|fight|jihad)|"
            r"surah.{0,20}(?:kill|fight|jihad|war)|"
            r"(?:imran|ale.?imran|aal.?imran).{0,40}(?:kill|fight|jihad|war|context)"
        ),
        "terms": ["jihad", "qital", "fight", "killed", "path of Allah", "cause", "believers", "martyrs", "steadfast", "enemy", "war", "forbidden", "oppression", "context"],
        "dua_categories": [],
        "verse_keys": ["3:169", "3:195", "3:157", "3:13", "2:190", "2:216", "4:74", "2:256", "60:8"],
        "hadith_refs": [],
    },
    {
        "id": "inheritance",
        "priority": 78,
        "pattern": (
            r"inherit|mirath|وراثت|miras|विरासत|"
            r"(?:property|estate|wealth|assets?).{0,40}(?:son|daughter|child|children|parent|divid|share|between)|"
            r"(?:son|daughter|child|children).{0,40}(?:property|share|inherit|parent)|"
            r"divid(?:e|ing).{0,30}(?:property|estate|inherit)"
        ),
        "terms": ["inherit", "inheritance", "share", "children", "sons", "daughters", "parents", "estate", "property", "will", "division", "mirath"],
        "dua_categories": [],
        "verse_keys": ["4:11", "4:12", "4:176", "2:180"],
        "hadith_refs": [],
    },
    {
        "id": "yusuf",
        "priority": 70,
        "pattern": (
            r"yusuf|yousef|yoseph|joseph|یوسف|यूसुफ|"
            r"story.{0,30}(?:yusuf|yousef|joseph|surah\s*12)|"
            r"surah.{0,15}(?:yusuf|yousef|joseph)|"
            r"what.{0,20}(?:yusuf|yousef|joseph).{0,20}teach"
        ),
        "terms": ["yusuf", "joseph", "patience", "trust", "forgiveness", "trial", "brothers", "story", "lesson"],
        "dua_categories": [],
        "verse_keys": ["12:111", "12:6", "12:100", "12:101", "12:83"],
        "hadith_refs": [],
    },
    {
        "id": "revelation_period",
        "priority": 65,
        "pattern": (
            r"meccan|medinan|makki|madani|makkah|madinah|mecca|medina|"
            r"how\s+many\s+surah.{0,30}(?:mecc|medin|makki|madani|origin|revealed)|"
            r"(?:mecc|medin|makki|madani).{0,30}(?:how\s+many|number|count|surah)"
        ),
        "terms": ["meccan", "medinan", "makki", "madani", "makkah", "madinah", "revelation", "revealed", "hijrah"],
        "dua_categories": [],
        "verse_keys": ["3:3", "5:3", "17:1"],
        "hadith_refs": [],
    },
    {
        "id": "riba",
        "priority": 80,
        "pattern": (
            r"riba|ribaa|ربا|سود|sood|usury|"
            r"(?:bank|loan|credit|mortgage|finance).{0,30}(?:interest|halal|haram|permiss)|"
            r"(?:interest).{0,30}(?:bank|loan|haram|halal|permiss|money)|"
            r"interest.{0,20}(?:earn|pay|charg|allow|forbid)|"
            r"(?:haram|halal|permiss).{0,30}interest"
        ),
        "terms": ["riba", "usury", "interest", "forbidden", "prohibited", "trade", "halal", "debt", "loan", "consume", "devour", "doubling"],
        "dua_categories": [],
        "verse_keys": ["2:275", "2:276", "2:278", "2:279", "3:130", "4:161"],
        "hadith_refs": [],
    },
    {
        "id": "halal_haram",
        "priority": 40,
        "pattern": r"(?:is|are).{0,20}(?:halal|haram|permissible|allowed|forbidden|prohibited|lawful|unlawful)",
        "terms": ["halal", "haram", "permissible", "forbidden", "lawful", "unlawful", "allowed", "prohibited"],
        "dua_categories": [],
        "verse_keys": ["2:168", "5:3", "6:145"],
        "hadith_refs": [],
    },
]

THEME_SUMMARIES: dict[str, dict[str, str]] = {
    "fitrah": {
        "en": (
            "Zakat al-Fitr (Fitrana) is obligatory on every Muslim — young or old, male or female. "
            "The Prophet ﷺ prescribed one Sa' of dates or barley per person (about 3 kg), paid before "
            "Eid al-Fitr prayer (Sahih al-Bukhari 1451–1453). Many communities pay a fixed cash amount "
            "set locally each Ramadan — confirm the rate with your local mosque or scholar."
        ),
        "ur": (
            "زکوٰۃُ الفطر (فطرانہ) ہر مسلمان پر واجب ہے — چھوٹے بڑے، مرد و عورت سب پر۔ "
            "نبی ﷺ نے فی شخص ایک صاع کھجور یا جو کا حکم دیا، عید الفطر کی نماز سے پہلے ادا کرنا ہے "
            "(صحیح بخاری 1451–1453)۔ بہت سی جماعتیں نقد رقم ادا کرتی ہیں — اپنے علاقے کی مسجد یا "
            "عالم سے رقم معلوم کریں۔"
        ),
        "hi": (
            "ज़कातुल फ़ित्र (फ़ितराना) हर मुसलमान पर वाजिब है — बच्चे-बड़े, पुरुष-महिला सभी पर। "
            "नबी ﷺ ने प्रति व्यक्ति एक साअ खजूर या जौ का हुक्म दिया, ईदुल फ़ित्र की नमाज़ से पहले "
            "(सहीह बुखारी 1451–1453)। कई समुदाय नकद राशि देते हैं — अपने इलाके की मस्जिद या आलिम से "
            "दर जानें।"
        ),
    },
    "zakat_general": {
        "en": (
            "Zakat is the obligatory charity on qualifying wealth — one of the five pillars of Islam. "
            "The Quran commands believers to spend from what Allah has provided (2:267) and describes "
            "the categories of people who may receive it (9:60). The rate on savings held for one lunar year "
            "at nisab is 2.5% (one-fortieth), as stated in Sahih al-Bukhari 1405. "
            "Zakat al-Fitr (Fitrana) is a separate end-of-Ramadan obligation — ask specifically if you mean Fitrana."
        ),
        "ur": (
            "زکوٰة قابلِ مال پر واجب صدقہ ہے — اسلام کے پانچ ارکان میں سے ایک۔ "
            "قرآن مومنوں کو حکم دیتا ہے کہ اللہ نے جو دیا اس میں سے خرچ کریں (2:267) اور "
            "وصول کنندگان کی صفات بیان کرتا ہے (9:60)۔ نصاب پر ایک قمری سال بعد شرح 2.5% ہے "
            "(صحیح بخاری 1405)۔ زکوٰۃُ الفطر (فطرانہ) الگ واجب ہے — اگر فطرانہ پوچھیں تو علیحدہ بتائیں۔"
        ),
        "hi": (
            "ज़कात क़ाबिल धन पर वाजिब सदक़ा है — इस्लाम के पाँच स्तंभों में से एक। "
            "कुरान मोमिनों को हुक्म देता है कि अल्लाह ने जो दिया उसमें से खर्च करें (2:267) और "
            "पाने वालों की सूची बताता है (9:60)। निसाब पर एक क़मरी साल बाद दर 2.5% है "
            "(सहीह बुखारी 1405)। ज़कातुल फ़ित्र (फ़ितराना) अलग वाजिब है।"
        ),
    },
    "zakat_rate": {
        "en": (
            "Zakah on qualifying wealth is 2.5% (one-fortieth) when it reaches nisab and has been held "
            "for one lunar year — it is not a Ramadan-only payment. Abu Bakr's letter citing the Prophet ﷺ "
            "states: 'For silver the Zakat is one-fortieth of the lot (i.e. 2.5%)' (Sahih al-Bukhari 1405). "
            "Livestock and crops have different rates. See sources for details."
        ),
        "ur": (
            "قابلِ زکوٰۃ مال پر زکوٰۃ 2.5% (چالیسواں حصہ) ہے جب نصاب پورا ہو اور ایک قمری سال گزر جائے — "
            "یہ صرف رمضان کی ادائیگی نہیں۔ حضرت ابوبکرؓ کا خطوط نبی ﷺ کے مطابق: 'چاندی کی زکوٰۃ "
            "مال کا چالیسواں حصہ (یعنی 2.5%)' (صحیح بخاری 1405)۔ مویشی اور فصل کی شرح الگ ہے۔"
        ),
        "hi": (
            "क़ाबिल ज़कात धन पर ज़कात 2.5% (चालीसवाँ हिस्सा) है जब निसाब पूरा हो और एक क़मरी साल बीत जाए — "
            "यह सिर्फ़ रमज़ान की अदायगी नहीं। अबू बक्र का ख़त नबी ﷺ के मुताबिक़: 'चाँदी की ज़कात "
            "माल का चालीसवाँ हिस्सा (यानी 2.5%)' (सहीह बुखारी 1405)। पशु और फ़सल की दर अलग है।"
        ),
    },
    "study": {
        "en": (
            "There is no single fixed 'exam dua' in the Quran, but Muslims often ask Allah for knowledge "
            "and ease — especially the dua in Surah Ta-Ha (20:114): 'My Lord, increase me in knowledge.' "
            "See sources for related verses and hadith on seeking knowledge."
        ),
        "ur": (
            "قرآن میں کوئی ایک مقررہ 'امتحان کی دعا' نہیں، مگر مسلمان اکثر علم اور آسانی کے لیے دعا کرتے ہیں — "
            "خاص طور پر سورہ طہ (20:114) کی دعا: 'اے میرے رب! میرے علم میں اضافہ فرما۔' "
            "علم کے متعلق آیات و احادیث کے لیے ذرائع دیکھیں۔"
        ),
        "hi": (
            "कुरान में कोई एक निश्चित 'परीक्षा की दुआ' नहीं है, पर मुसलमान अक्सर ज्ञान और आसानी के लिए दुआ करते हैं — "
            "खासकर सूरह तहा (20:114): 'ऐ मेरे रब! मेरे ज्ञान में इज़ाफा कर।' "
            "संबंधित आयतें और हदीस के लिए स्रोत देखें।"
        ),
    },
    "sleep": {
        "en": (
            "Before sleep, the Prophet ﷺ would recite Surah Al-Mulk (67), Ayat al-Kursi (2:255), and the last three "
            "surahs — Al-Ikhlas, Al-Falaq, and An-Nas (112–114) — then blow into his palms and wipe over his body. "
            "Al-Mulk is widely recommended for protection from the punishment of the grave; the three Quls seek "
            "Allah's protection through the night."
        ),
        "ur": (
            "سونے سے پہلے نبی ﷺ سورہ الملک (67)، آیت الکرسی (2:255)، اور آخری تین سورتیں — اخلاص، فلق اور ناس "
            "(112–114) — پڑھتے، پھر دونوں ہاتھوں پر پھونک مار کر جسم پر پھیرتے تھے۔ الملک قبر کے عذاب سے بچاؤ "
            "کے لیے مشہور ہے؛ تین قل رات بھر اللہ کی حفاظت کے لیے ہیں۔"
        ),
        "hi": (
            "सोने से पहले नबी ﷺ सूरह अल-मुल्क (67), आयतुल कुर्सी (2:255), और आखिरी तीन सूरतें — इख़्लास, फ़लक़ "
            "और नास (112–114) — पढ़ते, फिर हथेलियों पर फूंक मारकर शरीर पर मलते थे। अल-मुल्क क़ब्र के अज़ाब से "
            "बचाव के लिए प्रसिद्ध है; तीन क़ुल रात भर अल्लाह की हिफ़ाज़त के लिए हैं।"
        ),
    },
    "salah": {
        "en": (
            "The Quran commands believers to establish prayer (salah) at appointed times (4:103, 2:238) and describes "
            "it as a defining trait of the faithful (70:22–23). Prayer connects a Muslim to Allah throughout the day."
        ),
        "ur": (
            "قرآن مومنوں کو مقررہ اوقات پر نماز قائم کرنے کا حکم دیتا ہے (4:103، 2:238) اور اسے مومنین کی علامت "
            "قرار دیتا ہے (70:22–23)۔ نماز دن بھر اللہ سے تعلق قائم رکھتی ہے۔"
        ),
        "hi": (
            "कुरान ईमान वालों को निर्धारित समय पर नमाज़ क़ायम करने का हुक्म देता है (4:103, 2:238) और इसे "
            "मोमिनों की पहचान बताता है (70:22–23)। नमाज़ पूरे दिन अल्लाह से राब्ता बनाए रखती है।"
        ),
    },
    "asr_madhab": {
        "en": (
            "Scholars differ on Asr time: the Hanafi madhab counts the shadow length from when the sun has declined "
            "(often later Asr), while the Shafi'i madhab counts from when the shadow equals the object's length "
            "(earlier Asr). Both rely on authentic hadith about afternoon prayer."
        ),
        "ur": (
            "عصر کے وقت میں فقہاء اختلاف کرتے ہیں: حنفی مذہب میں سایہ دو گنا ہونے کا وقت (عام طور پر دیر کی عصر) "
            "اور شافعی مذہب میں سایہ برابر ہونے کا وقت (پہلی عصر) لیا جاتا ہے۔ دونوں احادیث پر مبنی ہیں۔"
        ),
        "hi": (
            "अस्र के समय पर विद्वानों में मतभेद है: हनफ़ी मज़हब में छाया दोगुनी होने का समय (अक्सर देर की अस्र) "
            "और शाफ़ी मज़हब में छाया बराबर होने का समय (पहली अस्र) माना जाता है। दोनों प्रामाणिक हदीस पर आधारित हैं।"
        ),
    },
    "ramadan": {
        "en": (
            "Fasting in Ramadan is ordained in the Quran (2:183–185) so believers may attain taqwa (God-consciousness). "
            "It teaches patience, gratitude, and empathy for those who are hungry."
        ),
        "ur": (
            "رمضان میں روزہ قرآن میں فرض کیا گیا (2:183–185) تاکہ لوگ تقویٰ حاصل کریں۔ یہ صبر، شکرگزاری "
            "اور بھوکوں کے احساس کی تعلیم دیتا ہے۔"
        ),
        "hi": (
            "रमज़ान में रोज़ा कुरान में फ़र्ज़ किया गया (2:183–185) ताकि लोग तक़वा पाएँ। यह सब्र, शुक्र "
            "और भूखों के प्रति सहानुभूति सिखाता है।"
        ),
    },
    "hajj": {
        "en": (
            "Hajj to the Sacred House is a pillar of Islam for those who are able (3:97). The Quran links it to "
            "the legacy of Ibrahim (AS) and unity of the ummah at Arafat and Mina."
        ),
        "ur": (
            "استطاعت رکھنے والوں پر بیت اللہ کا حج اسلام کا رکن ہے (3:97)۔ قرآن اسے حضرت ابراہیم کی میراث "
            "اور عرفات و منیٰ میں امت کی یکجہتی سے جوڑتا ہے۔"
        ),
        "hi": (
            "उस पर जिसकी सामर्थ्य हो, बैतुल्लाह का हज्ज इस्लाम का स्तंभ है (3:97)। कुरान इसे इब्राहीम (अलै.) "
            "की विरासत और अरफात व मिना में उम्मत की एकता से जोड़ता है।"
        ),
    },
    "charity": {
        "en": (
            "Zakat and charity (sadaqah) purify wealth and support the needy (9:60, 2:267). The Quran praises those "
            "who spend in Allah's cause without extravagance or stinginess."
        ),
        "ur": (
            "زکوٰۃ اور صدقہ مال کو پاک کرتے ہیں اور محتاجوں کی مدد کرتے ہیں (9:60، 2:267)۔ قرآن ان کی تعریف "
            "کرتا ہے جو اللہ کی راہ میں بے جا خرچی یا کنجوسی کے بغیر خرچ کرتے ہیں۔"
        ),
        "hi": (
            "ज़कात और सदक़ा धन को पाक करते हैं और ज़रूरतमंदों की मदद करते हैं (9:60, 2:267)। कुरान उनकी "
            "तारीफ़ करता है जो अल्लाह की राह में फिज़ूलख़र्ची या कंजूसी के बिना खर्च करते हैं।"
        ),
    },
    "neighbors": {
        "en": (
            "The Quran commands kindness to neighbors alongside parents and relatives (4:36). The Prophet ﷺ "
            "emphasized neighbors' rights so strongly that companions thought they might inherit from them."
        ),
        "ur": (
            "قرآن والدین اور رشتہ داروں کے ساتھ پڑوسیوں کے ساتھ حسن سلوک کا حکم دیتا ہے (4:36)۔ نبی ﷺ نے "
            "پڑوسیوں کے حقوق پر اتنا زور دیا کہ صحابہ سمجھنے لگے شاید انہیں وراثت ملے گی۔"
        ),
        "hi": (
            "कुरान माता-पिता और रिश्तेदारों के साथ पड़ोसियों के प्रति भलाई का हुक्म देता है (4:36)। नबी ﷺ "
            "ने पड़ोसियों के हक़ पर इतना ज़ोर दिया कि सहाबा को लगा शायद उन्हें विरासत मिलेगी।"
        ),
    },
    "purpose": {
        "en": (
            "The Quran teaches that humans were created to worship Allah alone (51:56) and as trustees on earth (2:30). "
            "Life is a test of deeds and gratitude — not aimless existence."
        ),
        "ur": (
            "قرآن سکھاتا ہے کہ انسان صرف اللہ کی عبادت کے لیے پیدا ہوئے (51:56) اور زمین کے نائب ہیں (2:30)۔ "
            "زندگی اعمال اور شکر کا امتحان ہے — بے مقصد وجود نہیں۔"
        ),
        "hi": (
            "कुरान सिखाता है कि इंसान केवल अल्लाह की इबादत के लिए पैदा हुए (51:56) और ज़मीन के नाइब हैं (2:30)। "
            "ज़िंदगी अमल और शुक्र की आज़माइश है — बेमतलब वजूद नहीं।"
        ),
    },
    "forgiveness": {
        "en": (
            "Allah's mercy encompasses all things (7:156). The Quran repeatedly invites believers to seek forgiveness — "
            "Allah loves those who repent and purify themselves (2:222)."
        ),
        "ur": (
            "اللہ کی رحمت ہر چیز پر محیط ہے (7:156)۔ قرآن بار بار بندوں کو مغفرت طلب کرنے کی دعوت دیتا ہے — "
            "اللہ توبہ کرنے والوں سے محبت کرتا ہے (2:222)۔"
        ),
        "hi": (
            "अल्लाह की रहमत हर चीज़ पर छाई है (7:156)। कुरान बार-बार बंदों को माफ़ी माँगने की दावत देता है — "
            "अल्लाह तौबा करने वालों से महब्बत करता है (2:222)।"
        ),
    },
    "marriage": {
        "en": (
            "The Quran describes marriage as a bond of love and mercy between spouses (30:21). Believers pray for "
            "righteous partners and tranquil homes (25:74)."
        ),
        "ur": (
            "قرآن نکاح کو میاں بیوی کے درمیان محبت اور رحمت کا بندھن قرار دیتا ہے (30:21)۔ مومن نیک ساتھی "
            "اور پرسکون گھر کی دعا کرتے ہیں (25:74)۔"
        ),
        "hi": (
            "कुरान निकाह को पति-पत्नी के बीच मोहब्बत और रहमत का बंधन बताता है (30:21)। मोमिन नेक साथी "
            "और सुकून भरे घर की दुआ करते हैं (25:74)।"
        ),
    },
    "health": {
        "en": (
            "Islam encourages seeking treatment when sick — the Prophet ﷺ taught that Allah sent down both disease and "
            "cure. Muslims pray for health and healing; related supplications and hadith on sickness and recovery appear "
            "in the sources below."
        ),
        "ur": (
            "اسلام بیماری میں علاج کرانے کی ترغیب دیتا ہے — نبی ﷺ نے سکھایا کہ اللہ نے بیماری اور شفا دونوں بھیجی ہیں۔ "
            "مسلمان صحت اور شفا کی دعا کرتے ہیں؛ متعلقہ دعائیں اور احادیث ذیل میں ہیں۔"
        ),
        "hi": (
            "इस्लाम बीमारी में इलाज कराने की तरगीब देता है — नबी ﷺ ने सिखाया कि अल्लाह ने बीमारी और शिफा दोनों भेजे हैं। "
            "मुसलमान सेहत और शिफा की दुआ करते हैं; संबंधित दुआएँ और हदीस नीचे हैं।"
        ),
    },
    "death": {
        "en": (
            "Islamic funeral (janazah) rites include washing the deceased, funeral prayer, and burial. The Quran reminds "
            "believers that every soul shall taste death (3:185) and encourages patience and prayer for the departed."
        ),
        "ur": (
            "اسلامی جنازے کے آداب میں میت کو غسل دینا، نمازِ جنازہ اور دفن شامل ہے۔ قرآن یاد دہانی کراتا ہے کہ ہر جانے "
            "کو موت کا مزہ چکھنا ہے (3:185) اور اہلِ میت کے لیے صبر اور دعا کی تلقین کرتا ہے۔"
        ),
        "hi": (
            "इस्लामी जनाज़ा में मय्यित को गुस्ल, नमाज़-ए-जनाज़ा और दफ़न शामिल हैं। कुरान याद दिलाता है कि हर जान "
            "को मौत चखनी है (3:185) और अहल-ए-मय्यित के लिए सब्र और दुआ की तालीम देता है।"
        ),
    },
    "scripture": {
        "en": (
            "Muslims believe Allah revealed the Torah (Tawrat) to Moses, the Gospel (Injil) to Jesus, and the Quran to "
            "Muhammad ﷺ as the final preserved revelation (3:3, 5:46, 5:68). Earlier scriptures were sent for guidance "
            "though Muslims hold the Quran as the authoritative text today."
        ),
        "ur": (
            "مسلمان مانتے ہیں کہ اللہ نے تورات حضرت موسیٰ، انجیل حضرت عیسیٰ، اور قرآن حضرت محمد ﷺ پر نازل کیے "
            "(3:3، 5:46، 5:68)۔ پہلے صحیفے ہدایت کے لیے تھے مگر آج قرآن حتمی اور محفوظ کتاب ہے۔"
        ),
        "hi": (
            "मुसलमान मानते हैं कि अल्लाह ने तौरात मूसा (अलै.) पर, इंजील ईसा (अलै.) पर, और कुरान मुहम्मद ﷺ पर "
            "नाज़िल किए (3:3, 5:46, 5:68)। पहले ग्रंथ हिदायत के लिए थे, पर आज कुरान अंतिम और संरक्षित किताब है।"
        ),
    },
    "science_knowledge": {
        "en": (
            "The Quran invites reflection on the signs of creation — in the heavens, earth, and within ourselves — as "
            "paths to knowledge and certainty about Allah (41:53, 3:190, 16:12). Seeking beneficial knowledge is praised "
            "in both Quran and Hadith."
        ),
        "ur": (
            "قرآن آسمانوں، زمین اور اپنے اندر کی نشانیوں پر غور کرنے کی دعوت دیتا ہے — یہ اللہ کے بارے میں "
            "علم اور یقین کے راستے ہیں (41:53، 3:190، 16:12)۔ نافع علم حاصل کرنا قرآن و حدیث میں تعریف یافتہ ہے۔"
        ),
        "hi": (
            "कुरान आसमानों, ज़मीन और अपने भीतर की निशानियों पर ग़ौर करने की दावत देता है — ये अल्लाह के बारे में "
            "इल्म और यक़ीन के रास्ते हैं (41:53, 3:190, 16:12)। फायदेमंद इल्म हासिल करना कुरान और हदीस में तारीफ़ पाता है।"
        ),
    },
    "anxiety": {
        "en": (
            "The Quran reminds us that with hardship comes ease (94:5–6) and that hearts find rest in the remembrance "
            "of Allah (13:28). Trust in Allah eases worry and grief."
        ),
        "ur": (
            "قرآن یاد دہانی کراتا ہے کہ مشکل کے ساتھ آسانی ہے (94:5–6) اور اللہ کے ذکر سے دلوں کو سکون ملتا ہے "
            "(13:28)۔ اللہ پر بھروسہ غم و فکر کو کم کرتا ہے۔"
        ),
        "hi": (
            "कुरान याद दिलाता है कि मुश्किल के साथ आसानी है (94:5–6) और अल्लाह के ज़िक्र से दिलों को सुकून "
            "मिलता है (13:28)। अल्लाह पर भरोसा ग़म और फिक्र को कम करता है।"
        ),
    },
    "parents": {
        "en": (
            "The Quran commands excellence to parents — especially in old age — and forbids even saying 'uff' to them (17:23). "
            "Paradise lies at the mother's feet according to prophetic teaching."
        ),
        "ur": (
            "قرآن والدین کے ساتھ احسان کا حکم دیتا ہے — خاص طور پر بڑھاپے میں — اور 'اف' تک کہنے سے منع کرتا ہے "
            "(17:23)۔ نبوی تعلیم کے مطابق جنت ماؤں کے قدموں تلے ہے۔"
        ),
        "hi": (
            "कुरान माता-पिता के साथ अहसान का हुक्म देता है — खासकर बुढ़ापे में — और 'उफ़' कहने से भी मना करता है "
            "(17:23)। नबी की तालीम के मुताबिक़ जन्नत माओं के क़दमों तले है।"
        ),
    },
    "patience": {
        "en": (
            "Sabr (patience) is praised throughout the Quran (2:153, 3:200). Believers are told that Allah is with the "
            "patient and that trials are a path to spiritual growth."
        ),
        "ur": (
            "صبر پورے قرآن میں تعریف یافتہ ہے (2:153، 3:200)۔ مومنوں کو بتایا گیا کہ اللہ صبر کرنے والوں کے ساتھ "
            "ہے اور آزمائشیں روحانی ترقی کا ذریعہ ہیں۔"
        ),
        "hi": (
            "सब्र पूरे कुरान में तारीफ़ पाता है (2:153, 3:200)। मोमिनों को बताया गया कि अल्लाह सब्र करने वालों के "
            "साथ है और आज़माइशें रूहानी उन्नति का ज़रिया हैं।"
        ),
    },
    "rizq": {
        "en": (
            "Allah is the Provider (Ar-Razzaq) who expands and restricts provision as He wills (11:6). The Quran encourages "
            "trust in Him while working lawfully for sustenance."
        ),
        "ur": (
            "اللہ رزاق ہے جو چاہے رزق فراخ یا تنگ کرے (11:6)۔ قرآن حلال کمائی کے ساتھ اللہ پر بھروسہ کرنے کی "
            "ترغیب دیتا ہے۔"
        ),
        "hi": (
            "अल्लाह रज़्ज़ाक़ है जो चाहे रिज़्क़ खुला या तंग करे (11:6)। कुरान हलाल कमाई के साथ अल्लाह पर "
            "भरोसा करने की तरगीब देता है।"
        ),
    },
    "riba": {
        "en": (
            "Riba (interest/usury) is explicitly forbidden in the Quran. Allah says: 'Allah has permitted trade and "
            "forbidden riba' (2:275). Those who consume riba are warned of severe punishment: 'O you who believe, "
            "do not consume riba, doubled and multiplied, and fear Allah that you may be successful' (3:130). "
            "The Quran commands: 'Give up what remains of riba if you are believers' (2:278). "
            "Bank interest, mortgage interest, and any fixed return on a loan are generally held to be riba "
            "by the majority of scholars — consult a qualified Islamic scholar for your specific situation."
        ),
        "ur": (
            "ربا (سود) قرآن میں صریحاً حرام ہے۔ اللہ فرماتا ہے: 'اللہ نے تجارت کو حلال اور سود کو حرام کیا ہے' "
            "(2:275)۔ سود کھانے والوں کو سخت وعید ہے: 'اے ایمان والو! کئی گنا بڑھا کر سود مت کھاؤ' (3:130)۔ "
            "قرآن حکم دیتا ہے: 'جو سود باقی رہ گیا ہو اسے چھوڑ دو اگر تم مومن ہو' (2:278)۔ "
            "بینک سود، قرض پر سود — اکثر علماء کے نزدیک یہ سب ربا میں شامل ہیں۔ اپنے معاملے کے لیے مستند عالم سے رہنمائی لیں۔"
        ),
        "hi": (
            "रिबा (ब्याज/सूद) कुरान में स्पष्ट रूप से हराम है। अल्लाह फरमाता है: 'अल्लाह ने व्यापार को हलाल और रिबा को "
            "हराम किया है' (2:275)। रिबा खाने वालों को सख्त वेद है: 'ऐ ईमान वालो! कई गुना बढ़ाकर रिबा मत खाओ' (3:130)। "
            "कुरान हुक्म देता है: 'जो रिबा बाकी रह गया हो उसे छोड़ दो अगर तुम मोमिन हो' (2:278)। "
            "बैंक ब्याज, कर्ज़ पर ब्याज — अधिकांश उलमा के अनुसार ये सब रिबा में शामिल हैं। अपने मामले के लिए किसी योग्य आलिम से मार्गदर्शन लें।"
        ),
    },
    "jihad": {
        "en": (
            "The Quran addresses fighting (qital) in specific contexts — not as unrestricted violence. "
            "Allah says: 'Fight in the cause of Allah those who fight you, but do not transgress' (2:190). "
            "In Surah Al Imran, believers are told that those who fight in Allah's cause and are killed or victorious "
            "receive a great reward (3:157, 3:169, 3:195). Scholars explain these verses with their historical context "
            "in tafsir — see the cited ayahs and Ibn Kathir commentary below."
        ),
        "ur": (
            "قرآن میں قتال مخصوص سیاق و سباق میں بیان ہوا ہے — بے قابو تشدد کے طور پر نہیں۔ "
            "اللہ فرماتا ہے: 'اللہ کی راہ میں ان سے لڑو جو تم سے لڑیں، لیکن حد سے تجاوز نہ کرو' (2:190)۔ "
            "سورہ آل عمران میں مومنوں کو بتایا گیا کہ جو اللہ کی راہ میں لڑتے ہیں اور شہید ہوتے ہیں یا فتح پاتے ہیں "
            "ان کے لیے بڑا اجر ہے (3:157، 3:169، 3:195)۔ علماء ان آیات کی تاریخی تفسیر بیان کرتے ہیں — ذیل میں حوالے دیکھیں۔"
        ),
        "hi": (
            "कुरान में क़िताल विशेष संदर्भ में बताया गया है — अनियंत्रित हिंसा के रूप में नहीं। "
            "अल्लाह फरमाता है: 'अल्लाह की राह में उनसे लड़ो जो तुमसे लड़ें, पर सीमा से आगे न बढ़ो' (2:190)। "
            "सूरह आल-इमरान में मोमिनों को बताया गया कि जो अल्लाह की राह में लड़ते हैं और शहीद होते हैं या विजय पाते हैं "
            "उनके लिए बड़ा अज्र है (3:157, 3:169, 3:195)। उलमा इन आयतों की ऐतिहासिक तफ़सीर बताते हैं — नीचे स्रोत देखें।"
        ),
    },
    "inheritance": {
        "en": (
            "Islamic inheritance (mirath) is detailed in Surah An-Nisa. Allah commands: 'Allah instructs you concerning "
            "your children: for the male, what is equal to the share of two females' (4:11). The shares of parents, "
            "spouses, and other relatives are also specified in 4:11–4:12 and 4:176. Making a will for heirs beyond "
            "one-third is restricted (2:180). See the cited verses for the full division rules."
        ),
        "ur": (
            "اسلامی وراثت (میراث) سورہ النساء میں تفصیل سے بیان ہے۔ اللہ فرماتا ہے: 'اللہ تمہیں تمہاری اولاد کے بارے میں "
            "حکم دیتا ہے: لڑکے کا حصہ دو لڑکیوں کے برابر' (4:11)۔ والدین، شریک حیات اور دیگر رشتہ داروں کے حصے "
            "4:11–4:12 اور 4:176 میں ہیں۔ وارثوں کے لیے ایک تہائی سے زیادہ وصیت محدود ہے (2:180)۔ مکمل تقسیم کے لیے حوالے دیکھیں۔"
        ),
        "hi": (
            "इस्लामी विरासत (मीरास) सूरह अन-निसा में विस्तार से है। अल्लाह फरमाता है: 'अल्लाह तुम्हें तुम्हारी औलाद के बारे में "
            "हुक्म देता है: लड़के का हिस्सा दो लड़कियों के बराबर' (4:11)। माता-पिता, जीवनसाथी और अन्य रिश्तेदारों के हिस्से "
            "4:11–4:12 और 4:176 में हैं। वारिसों के लिए एक-तिहाई से अधिक वसीयत सीमित है (2:180)। पूर्ण विभाजन के लिए स्रोत देखें।"
        ),
    },
    "yusuf": {
        "en": (
            "The story of Prophet Yusuf (Joseph) teaches patience through severe trials — betrayal by brothers, slavery, "
            "false accusation, and imprisonment — yet trust in Allah. He said: 'Indeed, he who fears Allah and is patient, "
            "then indeed, Allah does not allow to be lost the reward of those who do good' (12:90). The surah concludes: "
            "'There was certainly in their stories a lesson for those of understanding' (12:111). See sources for key ayahs."
        ),
        "ur": (
            "حضرت یوسفؑ کی کہانی سخت آزمائشوں میں صبر سکھاتی ہے — بھائیوں کی سازش، غلامی، بہتان اور قید — مگر اللہ پر بھروسہ۔ "
            "انہوں نے فرمایا: 'جو اللہ سے ڈرتا ہے اور صبر کرتا ہے تو اللہ نیکی کرنے والوں کا اجر ضائع نہیں کرتا' (12:90)۔ "
            "سورہ کا خاتمہ: 'ان کی کہانیوں میں عقل والوں کے لیے عبرت ہے' (12:111)۔ اہم آیات کے لیے ذرائع دیکھیں۔"
        ),
        "hi": (
            "हज़रत यूसुफ़ अलैहिस्सलाम की कहानी कठिन आज़माइशों में सब्र सिखाती है — भाइयों की साज़िश, गुलामी, झूठा इल्ज़ाम और क़ैद — "
            "फिर भी अल्लाह पर भरोसा। उन्होंने कहा: 'जो अल्लाह से डरता है और सब्र करता है तो अल्लाह नेकी करने वालों का अज्र ज़ाया नहीं करता' (12:90)। "
            "सूरह का अंत: 'उनकी कहानियों में अक्ल वालों के लिए इबरत है' (12:111)। मुख्य आयतों के लिए स्रोत देखें।"
        ),
    },
    "revelation_period": {
        "en": (
            "Scholars classify the 114 surahs by where they were first revealed: approximately **86 surahs are Meccan** "
            "(revealed before Hijrah in Makkah) and **28 are Medinan** (revealed after Hijrah in Madinah). "
            "Meccan surahs often focus on faith, tawhid, and the Hereafter; Medinan surahs often address law, "
            "community, and governance. Individual surah pages show each surah's revelation type."
        ),
        "ur": (
            "علماء 114 سورتوں کو نزول کی جگہ کے مطابق تقسیم کرتے ہیں: تقریباً **86 مکی** (ہجرت سے پہلے مکہ میں) "
            "اور **28 مدنی** (ہجرت کے بعد مدینہ میں)۔ مکی سورتیں ایمان، توحید اور آخرت پر مرکوز؛ مدنی سورتیں "
            "اکثر شریعت، معاشرہ اور حکومت سے متعلق۔ ہر سورہ کے صفحے پر نزول کی قسم دکھائی جاتی ہے۔"
        ),
        "hi": (
            "उलमा 114 सूरतों को नज़ूल की जगह के अनुसार वर्गीकृत करते हैं: लगभग **86 मक्की** (हिजरत से पहले मक्का में) "
            "और **28 मदनी** (हिजरत के बाद मदीना में)। मक्की सूरतें ईमान, तौहीद और आख़िरत पर केंद्रित; मदनी सूरतें "
            "अक्सर शरीअत, समाज और शासन से संबंधित। प्रत्येक सूरह के पृष्ठ पर नज़ूल का प्रकार दिखाया जाता है।"
        ),
    },
}

DUA_HINT = re.compile(r"\b(dua|duas|supplication|دعا|दुआ|prayer for)\b", re.I)
HADITH_HINT = re.compile(r"\b(hadith|hadeeth|sunnah|حدیث|हदीस|bukhari|sahih)\b", re.I)
PROPHET_HINT = re.compile(
    r"\b(?:what did (?:the )?prophet(?:\s+muhammad)?|prophet (?:say|said|teach|taught)|"
    r"messenger of allah (?:say|said)|muhammad (?:say|said|teach|taught)|rasool (?:say|said)|"
    r"نبی نے|رسول نے|पैगंबर ने)\b",
    re.I,
)
TAFSIR_HINT = re.compile(
    r"\b(tafsir|تفسیر|تفسير|commentary|explain|context|historical|background|meaning|scholar|interpretation|why does quran|why does allah|what does .+ mean|tell me more|elaborate|that verse|this ayah|this verse)\b",
    re.I,
)
TRAVEL_HINT = re.compile(r"\b(travel|journey|safar|سفر|trip)\b", re.I)

_CLUSTER_BY_ID: dict[str, dict[str, Any]] = {c["id"]: c for c in THEMATIC_CLUSTERS}


def match_themes(question: str) -> list[dict[str, Any]]:
    return [c for c in THEMATIC_CLUSTERS if re.search(c["pattern"], question, re.I)]


def theme_priority(theme_id: str) -> int:
    return int(_CLUSTER_BY_ID.get(theme_id, {}).get("priority", 0))


def expand_query(question: str, base_terms: list[str]) -> list[str]:
    terms = list(base_terms)
    for cluster in match_themes(question):
        terms.extend(cluster["terms"])
    return list(dict.fromkeys(terms))[:16]


def infer_dua_categories(question: str) -> list[str]:
    categories: list[str] = []
    for cluster in match_themes(question):
        categories.extend(cluster.get("dua_categories") or [])
    if not categories:
        q = question.lower()
        aliases = [
            (r"\brain\b", "rain"),
            (r"\bnew\s*home|moving\b", "home"),
            (r"\bprotection\b", "protection"),
            (r"\bguidance\b", "guidance"),
            (r"\bmorning\b", "morning"),
            (r"\bevening\b", "evening"),
            (r"\bpregnancy|newborn|children\b", "newborn"),
            (r"\bjob|interview|debt|success\b", "rizq"),
            (r"\bgrief|loss|loneliness\b", "anxiety"),
            (r"\bflight\b", "travel"),
            (r"\bgraduation|studying|wisdom\b", "study"),
            (r"\bwedding\b", "marriage"),
            (r"\bsick\b", "health"),
        ]
        for pattern, cat in aliases:
            if re.search(pattern, q):
                categories.append(cat)
    return list(dict.fromkeys(categories))


def infer_verse_keys(question: str) -> list[str]:
    keys: list[str] = []
    for cluster in match_themes(question):
        keys.extend(cluster.get("verse_keys") or [])
    return list(dict.fromkeys(keys))


def infer_hadith_refs(question: str) -> list[str]:
    refs: list[str] = []
    for cluster in match_themes(question):
        refs.extend(cluster.get("hadith_refs") or [])
    return list(dict.fromkeys(refs))


def get_theme_summary(themes: list[str], lang: str) -> str | None:
    if not themes:
        return None
    ordered = sorted(themes, key=theme_priority, reverse=True)
    for theme_id in ordered:
        summaries = THEME_SUMMARIES.get(theme_id)
        if summaries:
            return summaries.get(lang) or summaries.get("en")
    return None


def infer_source_filter(question: str) -> list[str]:
    q = question.lower()
    if PROPHET_HINT.search(q) or HADITH_HINT.search(q):
        return ["hadith", "quran"]
    if TAFSIR_HINT.search(q):
        return ["tafsir", "quran"]
    if DUA_HINT.search(q) or TRAVEL_HINT.search(q):
        return ["dua", "quran", "hadith"]
    return ["quran", "hadith", "dua", "tafsir"]


def build_analysis(question: str, lang: str, base_terms: list[str]) -> dict[str, Any]:
    themes = match_themes(question)
    terms = expand_query(question, base_terms)
    return {
        "search_terms": terms,
        "source_filter": infer_source_filter(question),
        "dua_categories": infer_dua_categories(question),
        "verse_keys": infer_verse_keys(question),
        "hadith_refs": infer_hadith_refs(question),
        "themes": [t["id"] for t in themes],
        "detected_language": lang,
        "intent": "expanded_search",
        "standalone_question": question,
    }
