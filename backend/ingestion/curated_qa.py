"""Hand-written Q&A for the question library: misconceptions and tough
questions, answered from the Quran, Sahih hadith and named mainstream
Sunni scholarship. Merged into the library JSON by merge_curated_qa.py.

Every citation here was chosen because it is checkable: Quran refs by
surah:ayah, hadith by collection and number, scholarship by author/work.
"""

QUESTIONS: list[dict] = [
    # ── Misconceptions & tough questions ────────────────────────────────
    {
        "slug": "hijab-oppression",
        "category": "misconceptions",
        "question": "Is the hijab a symbol of oppression? Why do Muslim women cover?",
        "tags": ["women", "hijab", "misconception"],
        "answer": """Oppression means being denied choice — and that is precisely what the Quran does not do. The command of modest dress (Quran 24:31, 33:59) is addressed to the believing woman herself, as an act of worship between her and Allah, just as the same passage first commands men to lower their gaze (24:30). A woman forced to cover against her will and a woman forced to uncover against her will suffer the same injustice: someone else controlling her body. Islam condemns both — "There is no compulsion in religion" (2:256).

Millions of educated women — surgeons, scientists, athletes, judges — wear hijab by conviction and describe it as liberation from being valued for appearance. Khadijah (r.a.) ran one of Makkah's major businesses; Aisha (r.a.) taught the greatest male scholars of her generation. The measure of dignity in Islam is taqwa, not visibility: "The most noble of you in the sight of Allah is the most righteous of you" (49:13).""",
        "sources": ["Quran 24:30-31, 33:59, 2:256, 49:13", "Yaqeen Institute — publications on hijab and women's dignity"],
    },
    {
        "slug": "inheritance-half-share",
        "category": "misconceptions",
        "question": "Why does a daughter inherit half of a son's share? Isn't that unfair?",
        "tags": ["women", "inheritance", "misconception"],
        "answer": """The 2:1 ratio (Quran 4:11) applies to one specific case — children inheriting from a parent — and it comes packaged with an asymmetry of obligations. The brother is legally required to spend on his wife, children, and needy relatives, including that very sister if she is in need; the sister's inheritance is exclusively her own, untouchable by anyone. Received wealth minus obligations often leaves her better off per person.

The full picture is more varied than the slogan: Islamic inheritance law contains cases where a woman receives an equal share (a mother and father each take one-sixth when the deceased leaves children — 4:11), and cases where female relatives receive more than males, depending on the family structure. Scholars have catalogued dozens of such configurations. Before Islam, women in Arabia were themselves inherited as property; the Quran made them legal heirs by name — a reform that reached parts of Europe only in the 19th century.""",
        "sources": ["Quran 4:7, 4:11-12, 4:32", "Yaqeen Institute — analyses of Islamic inheritance law"],
    },
    {
        "slug": "womens-testimony",
        "category": "misconceptions",
        "question": "Is a woman's testimony worth half of a man's in Islam?",
        "tags": ["women", "testimony", "misconception"],
        "answer": """The often-quoted verse (Quran 2:282) is not a general rule about testimony — it concerns one situation: witnessing written debt contracts, a commercial domain few women dealt with in that society. The verse itself gives the reason: "so that if one errs, the other can remind her" — familiarity, not capability.

Elsewhere the Quran counts testimony equally: in the li'an oath (24:6-9), a wife's sworn testimony cancels her husband's entirely. And in Islam's most consequential testimonial domain — transmitting the religion itself — a woman's solo report was always accepted with full weight. Aisha (r.a.) alone transmitted over 2,200 hadith on which law is built, and al-Dhahabi noted that among hadith narrators, no woman was ever condemned as a fabricator. Countless rulings rest on the report of one woman. A faith that took its religion from women's word did not consider that word half-valued.""",
        "sources": ["Quran 2:282, 24:6-9", "al-Dhahabi, Mizan al-I'tidal (on women narrators)", "Sahih al-Bukhari — narrations of Aisha (r.a.)"],
    },
    {
        "slug": "verse-4-34-wife-beating",
        "category": "misconceptions",
        "question": "Does Quran 4:34 permit husbands to beat their wives?",
        "tags": ["women", "marriage", "misconception"],
        "answer": """Start with the Prophet ﷺ, the Quran's living interpretation: "He never struck anything with his hand — not a woman, not a servant" (Sahih Muslim 2328). He said: "The best of you are the best to their wives, and I am the best of you to my wives" (Jami' at-Tirmidhi 3895), and in his Farewell Sermon he commanded kindness to women.

Verse 4:34 addresses a marriage collapsing through serious misconduct (nushuz) and imposes a de-escalation sequence: counsel first, separation of beds second, and only then the word daraba — which classical jurists (al-Tabari, al-Razi) restricted to a symbolic gesture that must be ghayr mubarrih: leaving no mark, causing no pain, never the face, and forbidden entirely if any harm results; Ibn Abbas glossed it as "with a miswak" (a toothbrush-sized twig). Meanwhile a wife harmed by her husband could — and did — obtain divorce and compensation from an Islamic court. The Prophet ﷺ himself shamed violence in marriage: "How does one of you strike his wife like a stallion, then embrace her?" (Sahih al-Bukhari 5204). A verse designed to slow angry men down was never a license for what he called disgraceful.""",
        "sources": ["Quran 4:34, 4:19, 30:21", "Sahih Muslim 2328", "Jami' at-Tirmidhi 3895", "Sahih al-Bukhari 5204", "Tafsir al-Tabari and al-Razi on 4:34"],
    },
    {
        "slug": "polygamy-four-wives",
        "category": "misconceptions",
        "question": "Why may a Muslim man marry up to four wives while a woman marries one husband?",
        "tags": ["marriage", "polygamy", "misconception"],
        "answer": """Islam did not introduce polygamy — it found a world of unlimited polygamy (pre-Islamic Arabia, and biblical figures with hundreds of wives) and capped it at four with a heavy condition: "…but if you fear you will not be just, then one" (Quran 4:3). The same surah warns "you will never be able to be perfectly just between wives" (4:129) — which is why monogamy is the overwhelming Muslim norm in every era.

The verse was revealed after the battle of Uhud, in the context of protecting widows and orphans: polygamy in Islam historically functioned as social absorption of war's demographics, not recreation. A woman marrying multiple men would make paternity — and therefore every child's lineage, inheritance and support rights — unknowable; the asymmetry protects children. And a woman who does not accept a co-wife can stipulate against it in her marriage contract — a condition the Hanbali school enforces outright (Sahih al-Bukhari 2721: "The conditions most deserving to be fulfilled are those by which intimacy is made lawful").""",
        "sources": ["Quran 4:3, 4:129", "Sahih al-Bukhari 2721", "Ibn Qudamah, al-Mughni (marriage stipulations)"],
    },
    {
        "slug": "muslim-woman-non-muslim-man",
        "category": "misconceptions",
        "question": "Why can a Muslim man marry a Christian or Jewish woman, but a Muslim woman cannot marry a non-Muslim man?",
        "tags": ["marriage", "women", "misconception"],
        "answer": """The asymmetry (Quran 2:221, 5:5) is about guaranteed respect, not hierarchy. A Muslim husband is bound by his own faith to honor his Christian or Jewish wife's religion: her prophets are his prophets, the origin of her scripture is affirmed in his Quran, and Islam obliges him to let her practice her faith freely. The guarantee runs from his religion to hers.

Reverse the arrangement and no such guarantee exists: a husband whose faith does not recognize Muhammad ﷺ is under no religious obligation to honor his wife's prayer, her fasting, or the Islamic upbringing of children — in historical contexts where marriage placed the wife substantially under the husband's authority. The rule is protective in structure, and it is the consensus of the four Sunni schools. What it is not is a comment on the worth of either spouse: the same law makes the Christian wife of a Muslim fully entitled to her mahr, maintenance and kind treatment (4:19).""",
        "sources": ["Quran 2:221, 5:5, 4:19", "Ibn Qudamah, al-Mughni — consensus of the four madhhabs"],
    },
    {
        "slug": "women-rights-islam",
        "category": "misconceptions",
        "question": "What rights did Islam actually give women?",
        "tags": ["women", "rights", "history"],
        "answer": """In 7th-century Arabia — where daughters could be buried alive (condemned in Quran 81:8-9) and widows were inherited like property — Islam legislated: a woman owns her property and earnings absolutely, marriage does not touch them (4:32); the dowry is paid to her, not her father (4:4); she cannot be married without her consent — the Prophet ﷺ annulled the marriage of al-Khansa bint Khidham when she objected (Sahih al-Bukhari 5138); she can initiate divorce through khula (Sahih al-Bukhari 5273); she inherits by Quranic right (4:7); seeking knowledge is her religious duty as much as any man's (Sunan Ibn Majah 224); and she keeps her own family name for life.

For comparison: English married women could not own property independently until 1870; French women could not open bank accounts without their husbands until 1965. Aisha (r.a.) issued legal rulings to senior Companions; al-Shifa bint Abdullah was appointed a market inspector of Madinah by Umar (r.a.). The claim that Islam invented women's subjugation inverts history: it arrived as the reform.""",
        "sources": ["Quran 4:4, 4:7, 4:32, 81:8-9", "Sahih al-Bukhari 5138, 5273", "Sunan Ibn Majah 224", "Ibn Hajar, al-Isabah (biographies of women Companions)"],
    },
    {
        "slug": "aisha-age-marriage",
        "category": "misconceptions",
        "question": "Why did the Prophet ﷺ marry Aisha (r.a.) at a young age?",
        "tags": ["prophet", "aisha", "marriage", "misconception"],
        "answer": """The marriage is reported by Aisha (r.a.) herself (Sahih al-Bukhari 5134) and deserves an honest answer in its historical frame. In 7th-century Arabia — as in Byzantine, Persian, Jewish and later European law for over a thousand years — marriage upon reaching maturity was the universal norm; Roman law set it at twelve, and it remained near that in parts of Europe into the 19th century. That is why not one of the Prophet's ﷺ many enemies — who attacked him relentlessly over far smaller things — ever criticized this marriage: it was unremarkable to everyone alive then.

The marriage was proposed by a third party, welcomed by Aisha's family, and became, in her own detailed telling, a deeply loving one. She then stood among Islam's greatest authorities for nearly fifty years after him — transmitting over 2,200 hadith, correcting senior Companions, teaching the men who taught the world. Hers is not the biography of a victim. Islam ties marriage to maturity and consent (a woman cannot be married without her agreement — Sahih al-Bukhari 5136), and Islamic law authorizes setting marriage ages by the welfare standards of each time and place, which Muslim countries today do. Judging one 7th-century norm by a 21st-century calendar — while exempting every other civilization of that era — is not a moral argument; it is an anachronism.""",
        "sources": ["Sahih al-Bukhari 5134, 5136", "Jonathan A.C. Brown, Misquoting Muhammad, ch. 5", "Yaqeen Institute — on the marriage of Aisha (r.a.)"],
    },
    {
        "slug": "prophet-multiple-wives",
        "category": "misconceptions",
        "question": "Why did the Prophet ﷺ have multiple wives?",
        "tags": ["prophet", "marriage", "misconception"],
        "answer": """Look at the shape of his life. At twenty-five he married Khadijah (r.a.), a widow fifteen years his senior, and remained monogamously devoted to her for twenty-five years until her death — through his entire youth. Every subsequent marriage came in his fifties, and with one exception (Aisha), every wife was a widow or divorcee, many neither young nor sought-after: Sawda, the aging widow of a persecuted emigrant; Umm Salama, widowed with four children; Juwayriyya and Safiyya, war captives whose marriages freed them and reconciled their tribes; Zaynab, married by direct Quranic command to break a social taboo (33:37); Umm Habiba, stranded in Abyssinia after her husband abandoned Islam.

These marriages sheltered widows, cemented alliances that ended wars, and produced the female scholars who transmitted the Prophet's ﷺ private practice — a substantial portion of ritual law reaches us through his wives. A man driven by desire does not spend ages twenty-five to fifty with one older widow, then fill his final decade with the widowed and the destitute.""",
        "sources": ["Quran 33:28-37, 33:50", "Ibn Kathir, al-Sira al-Nabawiyya — chapters on the Mothers of the Believers"],
    },
    {
        "slug": "zaynab-marriage",
        "category": "misconceptions",
        "question": "Why did the Prophet ﷺ marry Zaynab bint Jahsh (r.a.), the former wife of his adopted son?",
        "tags": ["prophet", "marriage", "misconception"],
        "answer": """Pre-Islamic Arabia treated an adopted son as a blood son — his ex-wife was permanently forbidden to the adoptive father, and adopted children carried false lineages with real legal consequences for inheritance and marriage law. The Quran abolished this legal fiction: adopted children keep their true parentage (33:4-5) — adoption as care remains a virtue; adoption as fabricated blood does not.

Zayd ibn Harithah (r.a.), whom the Prophet ﷺ had raised, was married to Zaynab (r.a.); the marriage was unhappy and Zayd himself repeatedly sought divorce (Quran 33:37 records the Prophet ﷺ telling him: "Keep your wife and fear Allah"). After the divorce, revelation commanded the Prophet ﷺ to marry Zaynab precisely to demolish the taboo in the most public way possible: "so that there would be no blame upon believers concerning the wives of their adopted sons" (33:37). No one demonstrates a law's abolition like the lawgiver's messenger acting on it. Had the Prophet ﷺ been inventing revelation for desire, this is the story he would have hidden — instead the Quran preserves even the correction of his hesitation, which Aisha (r.a.) noted: "Had he concealed anything of revelation, he would have concealed this verse" (Sahih Muslim 177).""",
        "sources": ["Quran 33:4-5, 33:36-40", "Sahih Muslim 177 (Aisha's comment)", "Tafsir Ibn Kathir on 33:37"],
    },
    {
        "slug": "banu-qurayza",
        "category": "misconceptions",
        "question": "Was the Prophet ﷺ violent? What really happened with Banu Qurayza?",
        "tags": ["prophet", "history", "misconception"],
        "answer": """Judge the pattern first. The man who was stoned at Ta'if prayed for his attackers' descendants; who conquered Makkah — the city that tortured and exiled his followers — and declared a general amnesty ("Go, you are free"); whose final commands forbade killing women, children, monks and even cutting trees in war. Two Jewish tribes of Madinah who broke their treaties, Qaynuqa and Nadir, were exiled — not killed.

Banu Qurayza was different in kind: during the Battle of the Trench, while a 10,000-strong confederate army besieged Madinah to exterminate its Muslims, the tribe broke its mutual-defense treaty and negotiated to open the city's undefended flank — wartime treason during an extermination siege. When they surrendered, they refused the Prophet's ﷺ judgment and chose their own arbiter: Sa'd ibn Mu'adh, chief of their long-time allies. His verdict — combatant men executed, dependents spared — matched the norms their own law codified (Deuteronomy 20:12-14) and applied to treason in essentially every legal system on earth until the modern era, including 20th-century ones. The event was a judicial sentence for treason by an arbiter of their choosing, not a religious massacre; Jewish communities continued living in Madinah and Khaybar afterward.""",
        "sources": ["Sahih al-Bukhari 4121 (Sa'd's arbitration)", "Ibn Ishaq/Ibn Hisham, Sira (Trench and Qurayza chapters)", "Sahih al-Bukhari 3052 (war ethics)", "Deuteronomy 20:12-14 (comparative law)"],
    },
    {
        "slug": "kill-them-wherever",
        "category": "misconceptions",
        "question": "Doesn't the Quran say 'kill them wherever you find them' (2:191, 9:5)?",
        "tags": ["violence", "quran-context", "misconception"],
        "answer": """Read one verse earlier. 2:190: "Fight in the way of Allah those who FIGHT YOU, and do not transgress — indeed Allah does not love transgressors." Then 2:191 addresses those specific aggressors — the Makkans who had tortured, dispossessed and exiled the Muslims and were waging active war — and 2:192-193 immediately adds: "but if they cease, then Allah is Forgiving and Merciful… if they cease, let there be no aggression except against oppressors."

The "sword verse" (9:5) concerns pagan tribes who had violated their treaties (9:4 explicitly exempts "those who have not failed you in anything of their treaty" — they must be honored to their term). And its very next verse commands: "If any polytheist seeks your protection, grant it, so he may hear the words of Allah — then ESCORT HIM TO SAFETY" (9:6). A genocide manual does not order safe passage for enemy civilians who ask for it. Every legal tradition reads its texts in context — a rule quoted without its conditions ("shooting an intruder is lawful" minus "in self-defense") sounds monstrous. The Quran's standing rule is 60:8: kindness and justice toward all who do not fight you.""",
        "sources": ["Quran 2:190-194, 9:4-6, 60:8-9", "Tafsir al-Tabari and Ibn Kathir on 2:190 and 9:5"],
    },
    {
        "slug": "islam-spread-by-sword",
        "category": "misconceptions",
        "question": "Was Islam spread by the sword?",
        "tags": ["history", "misconception"],
        "answer": """Indonesia — the largest Muslim nation on earth — never saw a conquering Muslim army; Islam arrived with traders. The same is true of Malaysia, much of West and East Africa, and the maritime silk route. Meanwhile Spain was under Muslim rule for nearly 800 years and remained heavily Christian throughout; India was ruled by Muslim dynasties for centuries and remained majority-Hindu — impossible outcomes if conversion had been forced.

The Quran forbids it outright: "There is no compulsion in religion" (2:256); "Had your Lord willed, everyone on earth would have believed — will you then compel people until they become believers?" (10:99). Early conquests were political expansions — the norm of every empire of that age, Byzantine and Persian included — but conquered peoples kept their churches, synagogues, courts and clergy under treaty; the pact Umar (r.a.) gave Jerusalem's Christians guaranteed their lives, churches and crosses. Historian Thomas Arnold's classic study "The Preaching of Islam" documents that Islam's spread tracked traders and Sufi teachers far more than armies — and centuries of Christian missionary presence under Muslim rule found communities free to remain Christian, which they did.""",
        "sources": ["Quran 2:256, 10:99, 109:6", "T.W. Arnold, The Preaching of Islam", "The pact of Umar (r.a.) with Jerusalem (al-Tabari, Tarikh)"],
    },
    {
        "slug": "jihad-meaning",
        "category": "misconceptions",
        "question": "What does 'jihad' actually mean?",
        "tags": ["jihad", "misconception"],
        "answer": """Jihad means struggle or striving — from the root j-h-d, exertion. The Quran uses it for effort far beyond battle: "Strive against them with it [the Quran] — a great jihad" (25:52) describes preaching; striving to serve parents, to give charity, to control one's temper and desires are all jihad in the Prophet's ﷺ usage: "The mujahid is the one who strives against his own soul" (Jami' at-Tirmidhi 1621).

Armed jihad exists — the Quran is not pacifist — but it is regulated war, not holy rage: declared by legitimate authority, only against combatants, with civilians absolutely protected. The Prophet ﷺ forbade killing women and children (Sahih al-Bukhari 3015); Abu Bakr's (r.a.) marching orders to his army codified it: no killing of children, women, the elderly or monks in their monasteries, no destruction of trees or livestock (Muwatta Malik 21.10). Treachery is forbidden even against enemies (Quran 8:58). The word's hijacking — by extremists who violate every one of these rules, and by polemicists who quote the extremists — does not change fourteen centuries of legal definition.""",
        "sources": ["Quran 25:52, 22:39-40, 8:58", "Jami' at-Tirmidhi 1621", "Sahih al-Bukhari 3015", "Muwatta Malik 21.10 (Abu Bakr's commands)"],
    },
    {
        "slug": "islam-terrorism",
        "category": "misconceptions",
        "question": "Does Islam permit terrorism or suicide attacks?",
        "tags": ["violence", "terrorism", "misconception"],
        "answer": """No — twice over. Killing civilians is categorically forbidden: "Whoever kills a soul — unless for murder or corruption in the land — it is as if he had slain all mankind" (Quran 5:32); the Prophet ﷺ forbade killing women, children and non-combatants even in declared war (Sahih al-Bukhari 3015), and even condemned burning as a punishment. Suicide is separately and absolutely forbidden: "Do not kill yourselves" (4:29); "Whoever kills himself with something will be punished with it on the Day of Resurrection" (Sahih al-Bukhari 6047). An act combining both prohibitions cannot be worship.

This is not a modern apologetic — it is the ruling of the mainstream scholarship of every school. The Amman Message (2004) — endorsed by over 500 scholars from 84 countries — and the 2014 Open Letter of 126 senior scholars to ISIS declared such violence a betrayal of Islamic law point by point. Statistically, the overwhelming majority of victims of terrorist groups claiming Islam are themselves Muslims — the mosques, markets and funerals they bomb are full of the people they claim to represent.""",
        "sources": ["Quran 5:32, 4:29, 2:190", "Sahih al-Bukhari 3015, 6047", "The Amman Message (2004)", "Open Letter to al-Baghdadi (2014, 126 scholars)"],
    },
    {
        "slug": "jizya-tax",
        "category": "misconceptions",
        "question": "What is jizya — a tax to humiliate non-Muslims?",
        "tags": ["history", "non-muslims", "misconception"],
        "answer": """Jizya was the non-Muslim counterpart of what Muslims already paid and did: Muslims owed zakat (2.5% of accumulated wealth, annually) and compulsory military service; covenanted non-Muslims (dhimmis) owed neither, paying instead a per-head tax that classical rates put at a few dinars a year — often less than zakat — in exchange for full state protection and military exemption. Women, children, the elderly, the disabled, monks and the poor were exempt; a poor dhimmi received stipends from the treasury, as when Umar (r.a.) saw an old Jewish man begging and ordered him pensioned: "We have not been fair to him — taking from his youth and abandoning his old age" (Abu Yusuf, Kitab al-Kharaj).

The protection was real and refundable: when Muslim forces withdrew from Homs unable to guarantee its defense, Khalid ibn al-Walid's administration returned the jizya collected — an event preserved in the same early sources (al-Baladhuri, Futuh al-Buldan). Non-Muslims who chose to fight alongside the Muslim army were exempted from jizya entirely. A humiliation tax does not come with refunds, pensions and opt-outs.""",
        "sources": ["Quran 9:29 with classical commentary", "Abu Yusuf, Kitab al-Kharaj", "al-Baladhuri, Futuh al-Buldan (Homs refund)"],
    },
    {
        "slug": "no-compulsion",
        "category": "misconceptions",
        "question": "Is there compulsion in Islam? What does 'no compulsion in religion' really mean?",
        "tags": ["freedom", "quran-context"],
        "answer": """"There is no compulsion in religion — the right course has become clear from error" (Quran 2:256). The verse's own revelation story shows it means what it says: some Ansar of Madinah had children who, before Islam, had been raised in Judaism; when the fathers embraced Islam they wanted to force their children to follow, and this verse was revealed to forbid them (Sunan Abi Dawud 2682).

It is not an isolated verse: "Had your Lord willed, everyone on earth would have believed — will you then compel people?" (10:99); "Say: the truth is from your Lord — whoever wills, let him believe, and whoever wills, let him disbelieve" (18:29); "You are only a reminder; you are not a controller over them" (88:21-22); "For you is your religion, and for me is mine" (109:6). Faith under duress is worthless in Islamic theology — belief is an act of the heart, and the Quran says the heart cannot be conscripted. Fourteen centuries of continuously existing Christian, Jewish, Zoroastrian and Hindu communities across the Muslim world are the practical record of this verse.""",
        "sources": ["Quran 2:256, 10:99, 18:29, 88:21-22, 109:6", "Sunan Abi Dawud 2682 (occasion of revelation)"],
    },
    {
        "slug": "apostasy-ruling",
        "category": "misconceptions",
        "question": "What is the ruling on leaving Islam? Is there a death penalty for apostasy?",
        "tags": ["freedom", "law", "misconception"],
        "answer": """An honest answer holds two facts together. First: the Quran mentions apostasy repeatedly (2:217, 3:90, 4:137, 5:54) and never once assigns a worldly punishment — 4:137 even describes people who "believed, then disbelieved, then believed, then disbelieved," which presupposes living apostates. The Prophet ﷺ himself released a Bedouin who took back his pledge of Islam and left Madinah unharmed (Sahih al-Bukhari 7209), and the Quran records hypocrites' unbelief without prescribing execution.

Second: classical jurists did prescribe capital punishment, based on the hadith "Whoever changes his religion, kill him" (Sahih al-Bukhari 6922). How do these reconcile? Leading scholars, classical and contemporary, locate that hadith in its political context: in a tribal war setting, leaving the community meant defecting to enemies at war — the hadith's cases pair apostasy with "abandoning the community" (Sahih Muslim 1676), i.e., treason, not private belief. Al-Sarakhsi (Hanafi) noted women apostates were not executed precisely because they were not combatants — evidence the issue was military, not theological. Contemporary senior scholars — Shaykh Abdullah bin Bayyah, Shaykh Ali Gomaa, and the Jonathan Brown/Yaqeen analysis — hold that in modern states, where religion and military allegiance are separate, no punishment attaches to private conversion; accountability is with Allah (2:256, 88:21-22).""",
        "sources": ["Quran 2:217, 4:137, 2:256", "Sahih al-Bukhari 7209, 6922", "Sahih Muslim 1676", "al-Sarakhsi, al-Mabsut", "Jonathan A.C. Brown / Yaqeen Institute — apostasy paper; Shaykh Abdullah bin Bayyah's rulings"],
    },
    {
        "slug": "islam-slavery",
        "category": "misconceptions",
        "question": "Why didn't Islam abolish slavery immediately — and what did it actually do?",
        "tags": ["history", "slavery", "misconception"],
        "answer": """Islam arrived in a world where slavery underpinned every economy from Rome to Persia to Africa — abolition by decree was enforceable by no one. What Islam built instead was a machine for emptying slavery out: freeing a slave was made the expiation for broken oaths (Quran 5:89), for accidental killing (4:92), for zihar (58:3), and one of the eight categories of zakat itself — state charity earmarked for buying freedom (9:60). "Freeing a neck" is the Quran's own image of righteousness (90:12-13). A slave could legally compel a manumission contract and buy his own freedom, with the master commanded to help fund it (24:33). The Prophet ﷺ freed every slave he ever received, said "your slaves are your brothers — feed them from what you eat, clothe them from what you wear" (Sahih al-Bukhari 30), and made freeing slaves among his final commands.

The result: Bilal the freed Abyssinian became Islam's first muezzin; freed slaves and their sons became the scholars of the next generation; slave-descended dynasties (the Mamluks) ruled empires. When global abolition finally came, Muslim scholars supported it as the fulfillment of the Sharia's own trajectory — the maqasid (objectives) the expiation system had always pointed toward. No pre-modern civilization did more to make freeing the enslaved an act of worship.""",
        "sources": ["Quran 4:92, 5:89, 9:60, 24:33, 58:3, 90:12-13", "Sahih al-Bukhari 30", "Jonathan A.C. Brown, Slavery and Islam"],
    },
    {
        "slug": "hudud-severity",
        "category": "misconceptions",
        "question": "Why are hudud punishments so severe?",
        "tags": ["law", "misconception"],
        "answer": """Hudud penalties are maximums designed for deterrence, wrapped in evidentiary standards designed to make them nearly unreachable. Adultery requires four eyewitnesses to the act itself — a bar so high that in practice convictions came almost solely from voluntary, repeated, retractable confession; the Prophet ﷺ turned Ma'iz away multiple times and looked for every doubt (Sahih Muslim 1695). Theft excludes takings under a threshold, from need, from open access, or in famine — Umar (r.a.) suspended the theft penalty entirely during the year of famine. And the standing rule from the Prophet ﷺ: "Avert the hudud by doubts" (idra'u al-hudud bi'l-shubuhat — Jami' at-Tirmidhi 1424): any doubt cancels the fixed penalty in favor of lesser judicial discretion.

Ottoman court records across centuries show hudud executions for zina were vanishingly rare — the law functioned as a moral ceiling, not a routine. Its purpose is the protection of the five essentials (life, faith, intellect, lineage, property); its design tells you it was meant to be feared, not frequently applied. Societies that applied the full system historically had crime rates their contemporaries envied — deterrence working as intended.""",
        "sources": ["Sahih Muslim 1695", "Jami' at-Tirmidhi 1424", "Umar's famine suspension (Ibn al-Qayyim, I'lam al-Muwaqqi'in)", "Ottoman court archives studies (e.g., U. Heyd, Studies in Old Ottoman Criminal Law)"],
    },
    {
        "slug": "kaaba-worship",
        "category": "misconceptions",
        "question": "Do Muslims worship the Kaaba or the Black Stone?",
        "tags": ["theology", "misconception"],
        "answer": """No. Muslims worship Allah alone; the Kaaba is a direction, not a deity. When a billion people pray toward one point (Quran 2:144), the point's function is unity — every prayer on earth addressed to the same God, aligned to the same center, built by Ibrahim and Ismail for exactly that purpose: "Our Lord, accept from us" (2:127). No Muslim believes the structure hears, benefits or harms; if the Kaaba's cloth is removed, it is stone and mortar, and prayers said inside it face any direction.

The definitive statement came from Umar (r.a.) at the Black Stone itself: "By Allah, I know you are only a stone — you cannot harm or benefit anyone. Had I not seen the Prophet ﷺ kiss you, I would never have kissed you" (Sahih al-Bukhari 1597). Kissing the stone is pure following of the Prophet's ﷺ act, stripped — by that very declaration — of any attribution of power. The contrast is the point: Islam's core message is that no created thing deserves worship (112:1-4), and the Kaaba's own history — cleansed of 360 idols at the conquest of Makkah — is the enactment of that message.""",
        "sources": ["Quran 2:127, 2:144, 112:1-4", "Sahih al-Bukhari 1597"],
    },
    {
        "slug": "same-god-abraham",
        "category": "misconceptions",
        "question": "Is Allah a different God from the God of Abraham, Moses and Jesus?",
        "tags": ["theology", "other-faiths"],
        "answer": """"Allah" is simply Arabic for The God — the same Semitic root as the Hebrew Elohim and the Aramaic Alaha that Jesus himself would have used in prayer. Arabic-speaking Christians and Jews called God "Allah" for centuries before Islam and still do today: open an Arabic Bible and Genesis 1:1 begins "Fi al-bad' khalaqa Allah…" — "In the beginning Allah created…"

The Quran states the identity explicitly, commanding Muslims to say to the People of the Book: "We believe in what was revealed to us and what was revealed to you — and our God and your God is One, and to Him we submit" (29:46). Islam presents itself not as a new religion with a new deity but as the restoration of the same call of Ibrahim, Musa and Isa (peace be upon them all): "He has ordained for you the same religion He enjoined upon Nuh… Ibrahim, Musa and Isa" (42:13). Muslims and Christians differ — seriously — about God's nature (the Trinity, the incarnation), but that is a disagreement about the description of the one God of Abraham, not the worship of a different one.""",
        "sources": ["Quran 29:46, 42:13, 3:64, 2:136", "Arabic Bible (Allah as 'God' throughout)"],
    },
    {
        "slug": "quran-preservation",
        "category": "misconceptions",
        "question": "Has the Quran been changed? And what are the ten qira'at?",
        "tags": ["quran", "preservation", "misconception"],
        "answer": """The Quran's preservation rests on two independent, mutually checking channels. First, mass memorization: from the Prophet's ﷺ lifetime to today, an unbroken chain of millions of huffaz carry the complete text — a corruption would require simultaneously altering memories across continents. Second, manuscripts: the Birmingham folios (radiocarbon-dated to within decades of the Prophet ﷺ), the Sanaa palimpsest, and the early codices agree with the text recited today — a manuscript record no other ancient book approaches.

The qira'at are not "versions": they are canonical modes of recitation taught by the Prophet ﷺ himself ("The Quran was revealed in seven ahruf" — Sahih al-Bukhari 4991), each transmitted with unbroken chains. Their differences are almost entirely pronunciation, vowel patterns, and occasional morphology (e.g., maliki/māliki "king/master" of the Day of Judgment in 1:4 — complementary meanings, both true), affecting no doctrine, no law, no narrative. They function like precisely catalogued recitation traditions, printed with full documentation — the opposite of textual chaos, and a transparency about transmission that texts preserved by single manuscript lines cannot offer. "Indeed, We sent down the Reminder, and indeed We will guard it" (15:9).""",
        "sources": ["Quran 15:9", "Sahih al-Bukhari 4991", "Birmingham Quran folios (University of Birmingham, 2015 dating)", "Introductions to the science of qira'at (Ibn al-Jazari, al-Nashr)"],
    },
    {
        "slug": "sun-muddy-spring",
        "category": "misconceptions",
        "question": "Does the Quran say the sun sets in a muddy pool (18:86)?",
        "tags": ["quran", "science", "misconception"],
        "answer": """Read the wording: "Until, when he reached the setting-place of the sun, he FOUND IT [wajadaha] setting in a murky spring" (18:86). The verb wajada describes what Dhul-Qarnayn found in his perception — the visual experience of a traveler reaching a western shore, where the sun appears to sink into the water at the horizon. Classical exegetes said exactly this centuries before telescopes: al-Razi and others note it describes the appearance to the observer, "as one at sea sees the sun setting into the water."

Every language speaks this way — English says "sunset" and "the sun sank into the sea" without asserting astronomy. The Quran's own cosmology elsewhere is explicit that the sun does not lodge anywhere: "The sun runs its course to a term appointed… and the sun and the moon — each swims in an orbit" (36:38-40); "He wraps the night over the day and wraps the day over the night" (39:5) — wrapping (yukawwir) around a rounded body. A book that describes orbits and rounded wrapping in one chapter is not asserting a mud-pool parking spot in another; it is narrating what a traveler saw, in the language travelers use.""",
        "sources": ["Quran 18:86 (wording), 36:38-40, 39:5", "Tafsir al-Razi on 18:86", "Tafsir Ibn Kathir on 36:38"],
    },
    {
        "slug": "seventy-two-virgins",
        "category": "misconceptions",
        "question": "Is the '72 virgins' claim real? What does the Quran actually say about Paradise?",
        "tags": ["afterlife", "misconception"],
        "answer": """The number 72 appears nowhere in the Quran. It comes from a single hadith in Jami' at-Tirmidhi (2562) that Tirmidhi himself flagged with a cautious grading, describing rewards of the lowest of Paradise's people in the extravagant idiom of abundance — like "seventy times" elsewhere meaning "beyond counting." Serious Islamic theology was never built on it, and the mocking caricature — Paradise as a reward for violence — collides with the actual texts: those who murder innocents are promised Hell, not Paradise (Quran 4:93, 5:32).

What the Quran actually promises is comprehensive: gardens and rivers, reunion with believing spouses and children (13:23, 36:56 — "they and their SPOUSES, reclining"), no fear, no fatigue, no ill speech — for women and men identically: "Whoever does righteousness, male or female, while a believer — they will enter Paradise" (4:124, 40:40). And it names the summit explicitly: "Allah has promised the believers gardens… but the PLEASURE OF ALLAH is greater — that is the supreme success" (9:72). The hadith says the people of Paradise, asked if they want anything more, will answer that nothing compares to gazing upon their Lord (Sahih Muslim 181).""",
        "sources": ["Quran 9:72, 4:124, 13:23, 56:22-38", "Sahih Muslim 181", "Jami' at-Tirmidhi 2562 (with its grading)"],
    },
    {
        "slug": "seventh-century-book",
        "category": "misconceptions",
        "question": "Why follow a 7th-century revelation in the modern world?",
        "tags": ["relevance", "misconception"],
        "answer": """Because what the Quran legislates is precisely the part of life that has not changed. Technology transforms tools; it has not updated honesty, justice, greed, mercy, envy, parenthood, mortality or the human heart between 610 and today. "Do not devour one another's wealth unjustly" (4:29) governed camel markets and governs crypto exchanges; the command of justice even against yourself (4:135) is not waiting for a firmware update.

Structurally, Islamic law was built for time: the Quran gives fixed principles and remarkably few fixed rules, and the institution of ijtihad — qualified reasoning applying those principles to new realities — is as old as the religion. That is how scholars handled coffee, printing, organ transplants and space travel prayer times without a new prophet. The alternative — anchoring morality to each decade's consensus — has its own record: the confident moral certainties of 1925 or 1975 look very different today, and today's will look different in fifty years. A fixed reference point outside the current is exactly what lets you evaluate the current. Muslims find it telling, not embarrassing, that the fastest-growing religion in the 21st century is anchored in something that does not drift.""",
        "sources": ["Quran 4:29, 4:135, 5:3", "Principles of ijtihad and maqasid (al-Shatibi, al-Muwafaqat)"],
    },
    {
        "slug": "quran-arabic-only",
        "category": "misconceptions",
        "question": "Why is the Quran only fully the Quran in Arabic? Can't I just read a translation?",
        "tags": ["quran", "language"],
        "answer": """Read translations — absolutely; they carry the meanings, and most of the world's Muslims rely on them. But Islam distinguishes between the Quran's message (translatable) and the Quran itself (the actual Arabic speech revealed to the Prophet ﷺ), for reasons that are practical as well as theological. The Quran's public claim — its challenge to produce anything like it (17:88, 2:23) — is made about its precise wording, sound and structure, which no rendering can carry; every translator of any literature knows translation is interpretation, and translations of the Quran differ from each other on hundreds of points where the Arabic holds multiple resonances at once.

There is also a unity argument you can hear: because prayer is in Arabic, a Malaysian, a Nigerian and a Bosnian can stand in one row in any mosque on earth and pray together, and a hafiz from any country can lead them. No other scripture community shares one liturgical text across all its languages and centuries. Learning even a little Quranic Arabic — this app's Learn Quran course exists for exactly this — moves you from reading about the Quran to hearing it, and generations of non-Arab Muslims (most of the ummah, always) have found that climb the sweetest part of the path.""",
        "sources": ["Quran 12:2, 17:88, 2:23, 41:44", "al-Suyuti, al-Itqan (on the inimitability of the Quran)"],
    },
    # ── God, doubt & the purpose of life ────────────────────────────────
    {
        "slug": "how-know-god-exists",
        "category": "god_and_purpose",
        "question": "How can I know God exists?",
        "tags": ["atheism", "belief", "philosophy"],
        "answer": """The Quran's own argument is compressed into two questions: "Were they created from nothing, or are they themselves the creators?" (52:35-36). Everything that begins needs a cause; the universe — including time and space themselves, on modern cosmology — began; an infinite chain of borrowed causes explains nothing, so the chain terminates in something uncaused, necessary, beyond time and space. That is the philosophical skeleton (the kalam argument, developed by Muslim theologians a millennium before its modern revival).

Then there is the calibration of the universe: dozens of physical constants set within margins so fine that eminent physicists coined "fine-tuning" to describe it — "We have created everything by measure" (54:49). And there is the fitrah — the built-in disposition the Quran says every soul carries (30:30), which surfaces uninvited in foxholes and delivery rooms. Islam does not ask for a leap in the dark; the Quran's constant refrain is "Do they not reflect?", pointing at the sky, the embryo, the alternation of night and day (3:190-191) as evidence. Doubt is not shameful — Ibrahim himself asked to be shown (2:260). The invitation is to follow the evidence where it points.""",
        "sources": ["Quran 52:35-36, 30:30, 3:190-191, 54:49, 2:260", "al-Ghazali's and al-Kindi's formulations of the cosmological argument"],
    },
    {
        "slug": "why-suffering",
        "category": "god_and_purpose",
        "question": "If God is good, why does He allow suffering and evil?",
        "tags": ["atheism", "suffering", "philosophy"],
        "answer": """Islam's answer begins by rejecting the premise that this world was meant to be a paradise. "He created death and life to test which of you is best in deed" (Quran 67:2) — the dunya is an examination hall, not a resort, and an exam with no difficulty tests nothing. Free will makes love, courage and generosity possible, and the same freedom makes cruelty possible; a world of puppets would contain no evil and no good.

But Islam adds what secular framings cannot: nothing is wasted, and the ledger does not close at death. "Those who are patient will be given their reward without account" (39:10); even a thorn's prick erases sins (Sahih al-Bukhari 5640). The sufferer is not collateral damage in a divine plan — the sufferer is the subject of the plan, compensated beyond calculation. And notice what the objection itself presupposes: calling suffering objectively evil requires an objective moral standard, which is easier to ground with God than without Him. The Quran's model is Ayyub (Job): affliction, patience, nearness, restoration (21:83-84) — and the promise that on the Day of Judgment, one dip in Paradise will make the most afflicted person say they never saw hardship (Sahih Muslim 2807).""",
        "sources": ["Quran 67:2, 2:155-157, 39:10, 21:83-84, 94:5-6", "Sahih al-Bukhari 5640", "Sahih Muslim 2807"],
    },
    {
        "slug": "eternal-hell-fair",
        "category": "god_and_purpose",
        "question": "How can eternal punishment be fair? What about people who never heard of Islam?",
        "tags": ["afterlife", "justice", "philosophy"],
        "answer": """Ground rules first. "Allah does not wrong anyone by an atom's weight" (Quran 4:40) and "We never punish until We have sent a messenger" (17:15) — mainstream theology holds, on that verse, that people the message never authentically reached are not condemned for it; they are tested on Judgment Day itself or judged by what they had (al-Ghazali argued most of humanity falls under mercy on this basis). The person punished is the one who received the truth clearly and knowingly rejected or betrayed it — hell is described as the consequence of arrogant refusal (2:6-7, 39:59), not geography of birth.

Second: mercy is the system's default, not its exception. "My mercy prevails over My wrath" (Sahih al-Bukhari 3194, hadith qudsi); one good deed counts tenfold, an evil deed once (6:160); repentance erases everything at any point before death (39:53). The Prophet ﷺ said Allah is more merciful to His servants than a mother to her child (Sahih al-Bukhari 5999). As for eternity — the Quran describes those in the Fire as people whose rejection was itself settled and permanent: "If they were returned, they would return to what they were forbidden" (6:28). The punishment tracks a fixed orientation of the soul, not a finite act arbitrarily stretched. And the final word belongs to justice tempered by a mercy we can't currently map: "Your Lord does whatever He wills" — and He has prescribed mercy upon Himself (6:12).""",
        "sources": ["Quran 4:40, 17:15, 6:12, 6:160, 39:53, 6:28", "Sahih al-Bukhari 3194, 5999", "al-Ghazali, Faysal al-Tafriqa (on those unreached)"],
    },
    {
        "slug": "why-many-religions",
        "category": "god_and_purpose",
        "question": "If Islam is true, why are there so many religions?",
        "tags": ["religions", "philosophy"],
        "answer": """Islam's account predicts religious plurality rather than being embarrassed by it. The Quran states that every nation received a messenger with the same core call — worship the one God, live justly (16:36, 35:24) — and that over generations, communities preserved fragments, added layers, and diverged. On this reading, the world's religions are not competing inventions but variously weathered copies of one original transmission: that is why flood narratives, prophets, fasting, pilgrimage, charity and prayer echo across faiths, and why the Quran calls itself a muhaymin — a criterion confirming and correcting what came before (5:48).

Islam then claims to be that same primordial message restored, not a 7th-century novelty: "He has ordained for you the religion He enjoined upon Nuh, Ibrahim, Musa and Isa" (42:13). Even the diversity itself has stated purpose: "Had Allah willed, He would have made you one community — but He tests you in what He has given you, so race to good deeds" (5:48). Truth being one does not mean the search leaves no footprints; Islam honors the footprints while inviting people to the source. And the practical test it proposes is open to anyone: read the Quran's claim about itself and judge it on evidence (2:23, 4:82).""",
        "sources": ["Quran 16:36, 35:24, 5:48, 42:13, 2:136", "Comparative religion studies on shared prophetic narratives"],
    },
    {
        "slug": "religion-causes-wars",
        "category": "god_and_purpose",
        "question": "Doesn't religion cause most wars?",
        "tags": ["violence", "history", "atheism"],
        "answer": """The claim doesn't survive its own century. The bloodiest hundred years in human history — the 20th — was dominated by explicitly secular or anti-religious projects: two World Wars fought over nationalism and empire, Stalin's purges, Mao's Great Leap, the Khmer Rouge — well over a hundred million dead with no religious motive anywhere in sight. The standard academic survey (the Encyclopedia of Wars, Phillips & Axelrod, covering 1,763 wars across history) classifies under 7% as religious in cause; the rest were fought over territory, resources, succession and power — the things humans actually kill for, with or without a creed to invoke.

Religion, like patriotism or revolution, is a banner powerful enough that men doing what they intended anyway will wave it. Islam's own law strips the banner from them: no killing of non-combatants ever (Sahih al-Bukhari 3015), no treachery, "whoever kills a soul, it is as if he killed all mankind" (5:32), and war only against aggression (2:190, 22:39-40). The honest ledger also has an asset column the slogan omits: hospitals, universities, abolition movements, charity networks and the daily restraint of billions — the wars religion prevented were never counted, because prevented wars leave no records.""",
        "sources": ["Phillips & Axelrod, Encyclopedia of Wars (statistical survey)", "Quran 5:32, 2:190, 22:39-40", "Sahih al-Bukhari 3015"],
    },
    {
        "slug": "faith-without-evidence",
        "category": "god_and_purpose",
        "question": "Isn't faith just belief without evidence?",
        "tags": ["atheism", "reason", "philosophy"],
        "answer": """Not in the Quran's vocabulary. Its challenge to opponents is "Produce your proof, if you are truthful" (2:111) — and a book that demands proof from others invites the same standard. It forbids inherited belief as a basis ("We found our fathers upon this" is quoted only to be condemned — 2:170), forbids assertion beyond one's knowledge ("Do not pursue what you have no knowledge of — the hearing, the sight, the heart: all will be questioned" — 17:36), and stakes its own authenticity on an examinable claim: "Do they not reflect upon the Quran? Had it been from other than Allah, they would have found in it much contradiction" (4:82).

Iman is better translated as conviction-plus-trust than blind belief: the Companions believed because of what they saw, heard and reasoned — and the Quran's arguments are addressed relentlessly to 'aql (reason), with "so that you may think," "for a people who reason" as its refrains. Where trust goes beyond present sight — the unseen, the afterlife — it is the same rational structure as trusting a demonstrated authority about what you haven't yet verified, not a leap against evidence. Al-Ghazali, Ibn Rushd and the entire kalam tradition are a thousand years of Muslims doing philosophy because their scripture told them to.""",
        "sources": ["Quran 2:111, 2:170, 17:36, 4:82, 41:53", "al-Ghazali; Ibn Rushd, Fasl al-Maqal (harmony of reason and revelation)"],
    },
    {
        "slug": "purpose-of-life",
        "category": "god_and_purpose",
        "question": "What is the purpose of life?",
        "tags": ["purpose", "philosophy"],
        "answer": """"I did not create jinn and humans except to worship Me" (Quran 51:56) — and ibadah (worship) in Islam is far wider than ritual: it is knowing God, and then living every role — spouse, parent, worker, neighbor — in loyalty to Him. Earning lawfully is worship; removing something harmful from the road is worship; even a smile is charity (Jami' at-Tirmidhi 1956). The five daily prayers are the skeleton; the muscle is a whole life oriented toward its Maker, as His khalifah (steward) on earth (2:30).

Consider the alternative seriously: if existence is an accident, then love, justice and sacrifice are chemistry with delusions of significance, and no life ultimately matters more than any other arrangement of atoms. Almost no one can live as if that were true — and Islam says the reason is the fitrah: you were built for meaning, and the homesickness is data. Purpose in Islam also comes with an audit: life is a test whose results are actually read (67:2), every atom's weight of good seen (99:7-8). That is what makes the anonymous kindness and the unwitnessed patience rational — nothing is wasted, and the destination is not the grave but "hearts finding rest in the remembrance of Allah" (13:28) on the way to meeting Him.""",
        "sources": ["Quran 51:56, 2:30, 67:2, 99:7-8, 13:28", "Jami' at-Tirmidhi 1956"],
    },
    {
        "slug": "bad-people-prosper",
        "category": "god_and_purpose",
        "question": "Why do bad people prosper while good people struggle?",
        "tags": ["justice", "philosophy"],
        "answer": """Because the scoreboard you're reading is not the scoreboard. The Quran addresses this exact complaint — believers watching the wicked flourish — and answers: "Let not their prosperity deceive you: a small enjoyment, then their refuge is Hell" (3:196-197), and more chillingly: "We only give them respite so that they may increase in sin" (3:178). Wealth and ease in Islam are tests, not grades: "We test you with evil and with good, as a trial" (21:35) — the CEO's empire and the patient's illness are both exam papers, not verdicts.

The Prophet ﷺ put it in one image: this world is the believer's prison and the disbeliever's paradise (Sahih Muslim 2956) — meaning the believer's restraint here is real, and so is the reversal coming. Justice delayed in this frame is not justice denied, because the frame extends past death: "On that Day people will proceed to be shown their deeds — whoever does an atom's weight of good will see it, and whoever does an atom's weight of evil will see it" (99:6-8). Meanwhile the struggling believer is not losing: sins are being erased, ranks raised, and du'a stored — three currencies invisible on the worldly scoreboard but denominated in eternity.""",
        "sources": ["Quran 3:178, 3:196-197, 21:35, 99:6-8", "Sahih Muslim 2956, 2807"],
    },
    {
        "slug": "science-and-faith",
        "category": "god_and_purpose",
        "question": "Can a scientific mind believe in God?",
        "tags": ["science", "reason", "atheism"],
        "answer": """Islam's first revealed word was "Read" (96:1), and the Quran points to embryology, astronomy, botany and the water cycle not as threats but as evidence: "Among His servants, it is the people of knowledge who truly fear Allah" (35:28) — a verse that makes scientists the natural theists. That is not hypothetical: the scientific method's early architecture was substantially built by believers commanded to study creation — Ibn al-Haytham founded experimental optics, al-Khwarizmi gave the world algorithms and algebra, and observatories, hospitals and universities (al-Qarawiyyin, 859 CE — the world's oldest) grew directly out of Muslim civilization. There is no church-vs-Galileo structure in Islam: no clergy licensed to veto research, and no scripture staking itself on a young earth or a flat cosmos.

Science and revelation answer different questions: science describes mechanisms (how the universe runs); revelation addresses meaning, morality and origin-of-the-whole (why there is anything to run, and how to live in it). The scientist who explains the engine has not explained away the engineer. It is no accident that the god-of-the-gaps is foreign to the Quran — its argument is not "you can't explain X" but "look how comprehensible, ordered and finely measured it all is" (54:49, 67:3-4) — which is, word for word, the observation that makes physicists wonder.""",
        "sources": ["Quran 96:1-5, 35:27-28, 67:3-4, 3:190-191", "Ibn al-Haytham, Book of Optics; history of science in Islamic civilization"],
    },
    {
        "slug": "why-god-needs-worship",
        "category": "god_and_purpose",
        "question": "Why would God need our worship?",
        "tags": ["theology", "philosophy"],
        "answer": """He doesn't — the Quran says so itself, repeatedly. "O mankind, you are the ones in need of Allah; Allah is the Free-of-need, the Praiseworthy" (35:15). "Whoever is grateful, is grateful only for his own soul's benefit" (31:12); "If you disbelieved — you and everyone on earth together — Allah is still Free of need" (14:8). Worship in Islam was never a supply line to heaven; it is the maintenance schedule of the human being.

Think of what the practices actually do to the one performing them: five daily prayers interrupt heedlessness and reset perspective; fasting installs self-command over the strongest appetites; zakat amputates greed and feeds the poor; gratitude rewires how you experience everything you already have; and remembrance quiets the anxiety of a creature that knows it will die — "Verily in the remembrance of Allah do hearts find rest" (13:28). A doctor prescribing exercise does not need your push-ups. The real question hiding inside this one is reversed by the Quran: not "why does God need worship?" but "why do humans, in every civilization ever recorded, need to worship — and what were they built for?" (30:30). Worship is not a tax paid to power; it is the soul plugged back into its source.""",
        "sources": ["Quran 35:15, 14:8, 31:12, 13:28, 30:30, 51:56-58"],
    },
    # ── Islam & modern science ──────────────────────────────────────────
    {
        "slug": "islam-evolution",
        "category": "islam_science",
        "question": "What does Islam say about evolution?",
        "tags": ["science", "evolution"],
        "answer": """Separate the layers, because Islam's position is more precise than a yes/no. On biology in general — change over time, natural selection, the age of the earth — the Quran stakes no claim that conflicts: it gives no six-thousand-year chronology and describes creation in stages and epochs (41:9-12, 71:14 "He created you in stages"). Muslim scholars as early as al-Jahiz (9th century) wrote about species adaptation and survival, a millennium before Darwin.

The firm line in mainstream Sunni theology is one specific claim: Adam (peace be upon him) was created directly and honored specially (Quran 38:71-76, 3:59), and humanity descends from him. How the rest of the living world developed — and even what biological processes God employed as His means — are questions many contemporary scholars treat as open, since the Quran describes God creating "every living thing from water" (21:30) and creating in whatever manner He wills. Science, for its part, describes mechanisms; it cannot in principle rule on whether a mechanism is guided. A Muslim biologist can accept the full data of genetics and paleontology while holding that Adam's creation was a distinct divine act — positions carefully laid out in contemporary scholarship (e.g., Yaqeen Institute's papers on evolution, David Solomon Jalajel's work).""",
        "sources": ["Quran 3:59, 38:71-76, 21:30, 71:14, 41:9-12", "al-Jahiz, Kitab al-Hayawan", "D.S. Jalajel, Islam and Biological Evolution; Yaqeen Institute papers"],
    },
    {
        "slug": "quran-embryology",
        "category": "islam_science",
        "question": "What does the Quran say about human development in the womb?",
        "tags": ["science", "embryology"],
        "answer": """"We created man from an extract of clay, then We made him a drop (nutfah) in a secure lodging, then We made the drop a clinging thing (alaqah), then We made the clinging thing a chewed-like lump (mudghah), then We made the lump bones, then We clothed the bones with flesh — then We produced him as another creation. Blessed is Allah, the best of creators" (23:12-14).

The fair way to present this: recited in 7th-century Makkah — centuries before microscopes, when the dominant Galenic theory held that a fully-formed miniature human simply grew larger — the Quran describes development as staged transformation, using words whose aptness is striking: alaqah means a clinging/suspended thing and a leech-like thing (the embryo attaches to the uterine wall and, in weeks 3-4, visibly resembles one); mudghah means a chewed lump (the somite-stage embryo bears surface segments like teeth marks); and cartilage models forming before muscle "clothes" them matches the observed sequence. Muslims present this as a sign inviting reflection — exactly the Quran's own framing, "We will show them Our signs in the horizons and in themselves" (41:53) — while sober scholarship avoids overclaiming: the verses are not a biology textbook, and their power is that a 7th-century text describing the unseen womb has nothing in it to retract.""",
        "sources": ["Quran 23:12-14, 22:5, 39:6, 41:53", "Keith L. Moore, The Developing Human (Islamic edition discussions)"],
    },
    {
        "slug": "quran-big-bang",
        "category": "islam_science",
        "question": "Does the Quran describe the Big Bang and the expanding universe?",
        "tags": ["science", "cosmology"],
        "answer": """Two verses draw the attention. "Do the disbelievers not see that the heavens and the earth were a joined entity, then We parted them — and We made from water every living thing?" (21:30). And: "We built the heaven with power, and indeed We are expanding it" (51:47) — the participle musi'un carrying the sense of continually extending, a reading classical dictionaries support and which sits remarkably beside the discovery (1929) that space itself expands.

The honest framing matters. Muslims do not claim the Quran is a physics paper, and responsible scholars warn against chaining tafsir to any era's provisional science. The claim is more modest and more interesting: a 7th-century text addressing all of history had endless opportunities to enshrine the cosmologies of its day — a static cosmos, crystalline spheres, a flat disc — and instead speaks of an initial unity parted, an ongoing expansion, orbits in which sun and moon swim (36:40), and a universe created "in truth and for an appointed term" (46:3), i.e., with a beginning and an end. Nothing there has needed retraction in fourteen centuries — which is precisely the pattern you'd expect from the verse's own challenge: "Had it been from other than Allah, they would have found in it much contradiction" (4:82).""",
        "sources": ["Quran 21:30, 51:47, 36:38-40, 46:3, 4:82", "Classical lexicons on musi'un (Lisan al-Arab)"],
    },
    {
        "slug": "prophetic-medicine",
        "category": "islam_science",
        "question": "How does Islam view medicine and seeking treatment?",
        "tags": ["science", "medicine", "health"],
        "answer": """Seeking cure is commanded, not merely allowed: "Allah has not sent down a disease except that He sent down its cure" (Sahih al-Bukhari 5678) — a hadith that functioned as a research program: it tells believers cures exist to be found. The Prophet ﷺ told the Companion who asked whether medicine contradicts reliance on God that treatment IS part of God's decree, and Muslim civilization built the world's first true hospitals (bimaristans in Baghdad, Cairo, Damascus — with wards, records and medical licensing) on that foundation; Ibn Sina's Canon of Medicine remained Europe's standard textbook for six centuries.

Islamic law ranks the preservation of life among its five supreme objectives — a fast is broken, a prayer shortened, a prohibition suspended when life or health requires it (2:173: necessity permits). Prophetic recommendations (honey — "in it is healing for people," 16:69; black seed; cupping) sit alongside, not instead of, professional medicine: the Prophet ﷺ sent the sick to the best physicians of his time, such as al-Harith ibn Kaladah. Contemporary fiqh councils apply the same logic to vaccination, transplantation and modern therapeutics — protecting life is worship, and the physician's craft is honored as a communal obligation (fard kifayah).""",
        "sources": ["Sahih al-Bukhari 5678", "Quran 16:69, 2:173, 5:32", "Ibn al-Qayyim, al-Tibb al-Nabawi", "History of the bimaristan; Ibn Sina, al-Qanun"],
    },
    {
        "slug": "islam-oppose-reason",
        "category": "islam_science",
        "question": "Does Islam oppose reason and critical thinking?",
        "tags": ["reason", "knowledge"],
        "answer": """The first word revealed was a command to read (96:1); the Quran's most repeated rebukes are "do they not reason?", "do they not reflect?", "most of them do not use their intellect" — variants of aql (reason), fikr (reflection) and ilm (knowledge) appear across hundreds of verses, and the Quran's condemnation of blind ancestral imitation (2:170, 43:23) is as sharp as any Enlightenment text. It even models debate etiquette: "Bring your proof" (2:111), and argue "in the manner that is best" (16:125).

The civilization built on it behaved accordingly: the House of Wisdom translated and surpassed Greek science; al-Khwarizmi, Ibn al-Haytham (the first experimentalist), al-Biruni (who measured the earth's radius within ~1%), Ibn Sina and Ibn Khaldun (founder of sociology and historiography) all worked as believing Muslims within a legal culture whose scholars were simultaneously its logicians. Ijtihad — the engine of Islamic law — is institutionalized reasoning, and the science of hadith criticism is arguably history's first systematic source-verification methodology, grading tens of thousands of reports by chain and content. Where Muslims later stagnated, the causes were political and economic — the religion's own texts kept pointing the other way, which is why every Muslim renewal movement begins by reopening the books.""",
        "sources": ["Quran 96:1-5, 2:111, 2:170, 16:125, 39:9", "Ibn al-Haytham's scientific method; al-Biruni's geodesy", "Ibn Khaldun, al-Muqaddimah"],
    },
    {
        "slug": "moon-splitting",
        "category": "islam_science",
        "question": "Did the moon really split? What about the claims of a 'crack' NASA found?",
        "tags": ["miracles", "science"],
        "answer": """"The Hour has drawn near, and the moon has split" (Quran 54:1). Mass-transmitted reports state the Makkans demanded a sign and the moon appeared divided into two parts (Sahih al-Bukhari 3636, 4864-4867, from multiple Companions) — a miracle witnessed and then reversed, in the same category as the staff of Musa: a temporary suspension of nature by the One who wrote nature's rules. For a Muslim, belief in it rests on the Quran and the authenticated reports — the same epistemic basis as every miracle in every scripture.

Honesty requires addressing the internet lore: claims that NASA discovered a "seam" proving the split are false and Muslims should not repeat them — the lunar rilles sometimes pictured are ordinary volcanic channels, and NASA has stated it has no evidence bearing on the event either way. Nor would one expect geological evidence from a momentary sign restored by the same power. It is also worth noting what the miracle did in its own narrative: the Quran records that the deniers who saw it called it "passing magic" (54:2) — a standing reminder that signs convince the open, not the determined; which is why the Quran's primary, permanent miracle is not an event in the sky but the recitation in your hands (17:88).""",
        "sources": ["Quran 54:1-2, 17:88", "Sahih al-Bukhari 3636, 4864-4867", "NASA public statements (no evidence claimed either way)"],
    },
    {
        "slug": "quran-water-cycle-seas",
        "category": "islam_science",
        "question": "What natural phenomena does the Quran describe accurately?",
        "tags": ["science", "signs"],
        "answer": """A sampler, offered as the Quran offers them — signs for reflection (41:53), not a substitute for science class. The water cycle: winds raised as glad tidings, clouds driven to dead land, rain descending by measure, rivers and springs threaded through the earth (7:57, 43:11, 39:21) — described as a closed, measured circuit. The two seas that meet with a barrier between them (55:19-20, 25:53): estuaries and straits where fresh and salt water, or two seas of different salinity and density, meet yet maintain distinct bodies — a phenomenon oceanography maps today with instruments. Deep-sea darkness, "layer upon layer of waves, above which are clouds — darknesses one above another; when he puts out his hand, he can hardly see it" (24:40) — recited by a man of the desert, describing the light-extinction zones of deep water. Mountains "as pegs" (78:7) — evocative of isostasy, mountains extending roots downward into the crust. And the sky as "a protected ceiling" (21:32) — the atmosphere and magnetosphere screening radiation and debris.

Each of these can be discussed cautiously — language accommodates multiple readings, and Muslims should resist stretching verses onto every new paper. The cumulative point is the one the Quran itself makes: a text from this source should contain nothing that breaks (4:82) — and after fourteen centuries of scrutiny in the age of telescopes and submarines, that record stands.""",
        "sources": ["Quran 7:57, 39:21, 55:19-20, 25:53, 24:40, 78:6-7, 21:32, 41:53, 4:82"],
    },
    {
        "slug": "astronomy-calendar-islam",
        "category": "islam_science",
        "question": "Why does Islam use a lunar calendar, and what did Muslims contribute to astronomy?",
        "tags": ["science", "astronomy", "calendar"],
        "answer": """"It is He who made the sun a shining light and the moon a derived light, and determined for it phases — that you may know the number of years and the account of time" (Quran 10:5). The lunar calendar is Islam's clock for worship: months begin with the crescent's birth, visible to any human anywhere without instruments or authorities — a democratic timekeeping fitting a global faith. Its 354-day year also walks Ramadan and Hajj through every season across a 33-year cycle, so no land fasts perpetually in easy winters or brutal summers — the burdens and mercies rotate over the whole earth.

The need to know prayer times (from sun angles) and the qibla direction (spherical trigonometry toward Makkah from any point on the planet) turned astronomy into a religious science: Muslim astronomers built the great observatories (Maragha, Samarqand — where Ulugh Beg's star catalogue reached accuracies unmatched for centuries), refined the astrolabe, measured the solar year to within seconds (al-Battani, whose data Copernicus cites by name), and the Tusi couple — a geometric device from Maragha — appears in Copernicus's own system. Star names the world still uses (Altair, Aldebaran, Betelgeuse, Vega's companions) and terms like zenith, nadir and azimuth are Arabic fossils of that project: a civilization computing its way to prayer.""",
        "sources": ["Quran 10:5, 36:38-40, 9:36", "al-Battani, al-Zij; Maragha and Samarqand observatories", "History of the Tusi couple and Copernicus"],
    },
    # ── Jesus, Mary & the Bible in Islam ────────────────────────────────
    {
        "slug": "jesus-in-islam",
        "category": "jesus_and_bible",
        "question": "What do Muslims believe about Jesus (peace be upon him)?",
        "tags": ["jesus", "other-faiths"],
        "answer": """No Muslim is a Muslim without believing in Jesus — Isa (peace be upon him) — as one of the greatest messengers of God. The Quran affirms his virgin birth (3:45-47: "She said, 'How can I have a child when no man has touched me?' He said, 'Thus Allah creates what He wills'"), calls him the Messiah, a Word from Allah and a spirit from Him (4:171), and recounts his miracles — healing the blind and the leper, raising the dead — "by Allah's permission" (3:49, 5:110). He is mentioned by name in the Quran twenty-five times, more than the Prophet Muhammad ﷺ.

What Islam declines is his divinity: he is the servant and messenger of God, not God's son — "It is not befitting for Allah to take a son" (19:35) — and Muslims believe he was neither killed nor crucified but raised by Allah (4:157-158), and will return before the end of time (Sahih al-Bukhari 3448) to a world he will fill with justice. The Prophet ﷺ said: "I am the closest of people to Jesus son of Mary… prophets are brothers; their mothers differ but their religion is one" (Sahih al-Bukhari 3443). Mockery of Jesus is unthinkable in Islam — his name is never written or spoken by practicing Muslims without 'peace be upon him'.""",
        "sources": ["Quran 3:45-49, 4:157-158, 4:171, 5:110, 19:16-36", "Sahih al-Bukhari 3443, 3448"],
    },
    {
        "slug": "mary-in-islam",
        "category": "jesus_and_bible",
        "question": "What does Islam say about Mary (peace be upon her)?",
        "tags": ["mary", "women", "other-faiths"],
        "answer": """Maryam (peace be upon her) is the only woman mentioned by name in the entire Quran — and she is named seventy times more often than in the New Testament by some counts, with the Quran's nineteenth chapter titled after her. The angels announce her rank in unambiguous words: "O Maryam, indeed Allah has chosen you and purified you and chosen you above the women of the worlds" (3:42). The Prophet ﷺ named her among the four most perfect women of all history (Sahih al-Bukhari 3432).

Her story fills some of the Quran's most tender passages: her mother's dedication of the unborn child to God's service (3:35-37), her upbringing in the sanctuary under Zakariyya's care — where he finds her supplied with provision he never brought and she answers, "It is from Allah" — the annunciation, her question ("How can I have a son when no man has touched me?" — 19:20), the birth alone beneath the palm tree with the stream at her feet, and her silent return carrying the newborn who speaks from the cradle to defend her honor (19:27-33). The Quran calls her a siddiqah — a woman of the highest rank of truthfulness (5:75) — and holds her up, alongside Pharaoh's believing wife, as an example for all believers, men and women alike (66:11-12).""",
        "sources": ["Quran 3:35-47, 19:16-34, 5:75, 66:12", "Sahih al-Bukhari 3432"],
    },
    {
        "slug": "muslims-and-bible",
        "category": "jesus_and_bible",
        "question": "Do Muslims believe in the Bible?",
        "tags": ["bible", "scripture", "other-faiths"],
        "answer": """Muslims believe God truly revealed the Tawrat (Torah) to Musa and the Injil (Gospel) to Isa (peace be upon them) — belief in those revelations is an article of Islamic faith (Quran 2:136, 5:44-46: "We sent down the Torah, in it guidance and light… and We gave him the Gospel, in it guidance and light"). Islam therefore never treats Jews and Christians as pagans: they are Ahl al-Kitab, People of the Book, with whom marriage and shared food are lawful (5:5).

The nuance: Muslims hold that today's biblical texts contain that revelation mixed with later human writing, editing and translation layers — the Quran speaks of words moved from their places and passages written by hands then attributed to God (2:79, 5:13). This is, notably, close to what modern textual scholarship itself describes: multiple authors, redactions, competing manuscripts, and books admitted into or dropped from differing canons. So the Quran positions itself as the muhaymin — the criterion over previous scriptures (5:48): where the Bible agrees with the Quran, Muslims affirm it; where it differs, the Quran arbitrates; where it is silent, Muslims stay neutral (Sahih al-Bukhari 7362: "Neither believe nor disbelieve the People of the Book's reports…"). Reverence for the original revelation and caution about the transmission are held together.""",
        "sources": ["Quran 2:136, 5:44-48, 5:5, 2:79", "Sahih al-Bukhari 7362"],
    },
    {
        "slug": "why-not-son-of-god",
        "category": "jesus_and_bible",
        "question": "Why don't Muslims believe Jesus is the son of God?",
        "tags": ["jesus", "theology", "other-faiths"],
        "answer": """Because of the principle Jesus himself, in the Quran's account, never compromised: "Indeed Allah is my Lord and your Lord, so worship Him — this is the straight path" (3:51). Islam's bedrock is tawhid — God's absolute oneness: "Say: He is Allah, the One; Allah, the Eternal Refuge; He neither begets nor is born, and there is none comparable to Him" (112:1-4). Begetting implies a partner, a beginning, a kind — categories of creatures, not of the Creator who says "Be" and it is (3:59, which pairs Jesus with Adam: both created without a father, neither divine for it).

The Quran also presses the practical observations: the Messiah and his mother "both used to eat food" (5:75) — beings who hunger are not the Self-Sufficient; and it stages the Day of Judgment scene where Jesus is asked whether he told people to worship him and his mother, and answers: "Glory be to You! It was not for me to say what I had no right to say… I only told them what You commanded me: worship Allah, my Lord and your Lord" (5:116-117). Muslims read the exaltation of Jesus into divinity as the work of later generations, not of Jesus — and note that trinitarian doctrine was formalized at councils centuries after him. Honoring Jesus, in Islam's eyes, means believing him — about God, and about himself.""",
        "sources": ["Quran 112:1-4, 3:51, 3:59, 5:75, 5:116-117, 19:88-93"],
    },
    {
        "slug": "crucifixion-islam",
        "category": "jesus_and_bible",
        "question": "Why do Muslims believe Jesus wasn't crucified?",
        "tags": ["jesus", "theology", "other-faiths"],
        "answer": """The Quran's statement is direct: "They did not kill him, nor did they crucify him, but it was made to appear so to them… rather, Allah raised him to Himself" (4:157-158). Muslims believe this on the authority of revelation — the same basis on which Christians believe the opposite — with the Quran claiming to correct the record as the final revelation's prerogative (5:48).

Two notes make the position less strange to Christian ears than it first sounds. Historically, the earliest centuries of Christianity themselves contained groups (docetists, and texts like the apocalypses found at Nag Hammadi) who held that the crucifixion was apparent rather than real — the idea did not enter history with Islam. Theologically, Islam has no doctrine of inherited sin requiring blood atonement: "No soul bears the burden of another" (6:164), and God forgives directly whomever repents (39:53) — so the cross carries no salvific necessity a Muslim's theology would miss. In Islam's telling, God's beloved messenger was rescued, not abandoned — honored with ascension (as Christians too affirm of him) and destined to return (Sahih Muslim 155), when, the Prophet ﷺ said, he will break the cross's symbolism himself and the People of the Book will recognize the truth of his story. Jesus alive with God is a point both faiths, remarkably, agree on.""",
        "sources": ["Quran 4:157-158, 6:164, 39:53, 3:55", "Sahih Muslim 155", "Early docetic traditions (historical note)"],
    },
    {
        "slug": "muhammad-in-bible",
        "category": "jesus_and_bible",
        "question": "Is Prophet Muhammad ﷺ mentioned in the Bible?",
        "tags": ["prophet", "bible", "other-faiths"],
        "answer": """The Quran claims he is: "…the unlettered Prophet whom they find written with them in the Torah and the Gospel" (7:157), and quotes Jesus foretelling "a messenger to come after me whose name is Ahmad" (61:6). Muslim scholars have long pointed to candidate passages. Deuteronomy 18:18 — "I will raise up for them a prophet LIKE YOU [Moses] from among THEIR BRETHREN, and I will put My words in his mouth" — fits Muhammad ﷺ with unusual precision: like Moses a lawgiver, leader, warrior and natural father (unlike Jesus in Christian doctrine on each count), from Israel's brethren (Ishmael's line), speaking verbatim revelation ("My words in his mouth" — the Quran's exact self-description).

In John 14-16, Jesus promises the Paraclete who "will not speak on his own, but will speak what he hears… and will guide you into all truth" — Muslims note this description of a human messenger transmitting received speech, and some scholars argue the underlying Greek periklytos ("praised one") corresponds to Ahmad/Muhammad ("the praised"). Isaiah 42's servant — a light to the nations from the line of Kedar (Ishmael's son), in whom God delights — is another classical citation, as is the Song of Solomon 5:16, where the Hebrew machamaddim ("altogether lovely/desirable") shares Muhammad's root letters. Christians read all these otherwise, and honest presentation says so — but the Muslim case is a serious textual argument, not a folk claim, and it is the Quran itself that stakes it.""",
        "sources": ["Quran 7:157, 61:6", "Deuteronomy 18:18; John 14:16, 16:13; Isaiah 42; Song of Solomon 5:16 (comparative discussion)", "Classical works: al-Biruni, Ibn Qayyim's Hidayat al-Hayara"],
    },
    {
        "slug": "peace-be-upon-him-jesus",
        "category": "jesus_and_bible",
        "question": "Why do Muslims say 'peace be upon him' after mentioning Jesus and other prophets?",
        "tags": ["etiquette", "prophets", "other-faiths"],
        "answer": """Because reverence for every prophet is built into Islam's creed, not just its manners. A Muslim's faith is invalid without believing in Musa, Isa, Ibrahim, Nuh and all the messengers (Quran 2:285: "We make no distinction between any of His messengers"), so their names are dressed in prayer: alayhi as-salam — peace be upon him. It is a small act of love with a large implication: these men are family to a Muslim's faith, and one does not mention family carelessly.

This is also why mockery of any prophet wounds Muslims so deeply, and why Islam forbids Muslims from initiating insult against what others hold sacred: "Do not insult those they invoke besides Allah, lest they insult Allah in enmity without knowledge" (6:108). You will never find practicing Muslims lampooning Jesus, Moses or Mary — the reverence is unconditional, not reciprocal courtesy. The Prophet ﷺ modeled the sensibility: when a Jewish funeral passed, he stood; asked why, he said, "Is it not a soul?" (Sahih al-Bukhari 1312). A tradition that stands for the dead of another faith prays peace upon the prophets of every faith — and Muslims quietly hope the courtesy teaches its own lesson about who Muhammad ﷺ was.""",
        "sources": ["Quran 2:285, 6:108, 4:150-152", "Sahih al-Bukhari 1312"],
    },
    {
        "slug": "islam-on-christians-jews",
        "category": "jesus_and_bible",
        "question": "How does Islam view Christians and Jews?",
        "tags": ["other-faiths", "coexistence"],
        "answer": """As People of the Book — a legal and theological category of honor that pagan Arabia's religions never received. Their scriptures' origins are affirmed as revelation (5:44-46); their food is lawful to Muslims and Muslim men may marry their women (5:5) — meaning Islam contemplates Christian and Jewish mothers raising Muslim children, grandmothers loved and served; and their houses of worship are named for protection in the very verse permitting defensive war: "monasteries, churches, synagogues and mosques, in which Allah's name is much mentioned" (22:40).

Theological disagreement is real and the Quran conducts it openly (call to shared ground: "Say: O People of the Book, come to a word common between us — that we worship none but Allah" — 3:64), but disagreement never licenses injustice: "Allah does not forbid you from being righteous and JUST toward those who have not fought you over religion — indeed Allah loves the just" (60:8). The Quran even distinguishes within communities: "Among the People of the Book are those who stand at night reciting God's verses and prostrating… they are of the righteous" (3:113-115). The Prophet's ﷺ practice matched: the Constitution of Madinah made its Jews one community with the believers in mutual defense; he honored a Jewish funeral, accepted Christian Najran's delegation into his own mosque, and warned: "Whoever wrongs a covenanted person — I will be his prosecutor on the Day of Judgment" (Sunan Abi Dawud 3052).""",
        "sources": ["Quran 5:5, 5:44-46, 22:40, 3:64, 3:113-115, 60:8", "Sunan Abi Dawud 3052", "The Constitution of Madinah (Ibn Ishaq)"],
    },
    # ── New Muslim practical FAQ ────────────────────────────────────────
    {
        "slug": "how-to-become-muslim",
        "category": "new_muslim",
        "question": "I want to accept Islam — what do I actually do?",
        "tags": ["new-muslim", "shahada"],
        "answer": """Say — with understanding and sincerity — the shahada: "Ashhadu an la ilaha illa Allah, wa ashhadu anna Muhammadan rasul Allah" ("I bear witness that there is no god but Allah, and I bear witness that Muhammad is the Messenger of Allah"). That's it. No ceremony, no certificate, no witnesses, no imam and no mosque are required — Islam has no baptism and no clergy gatekeeping the door; the covenant is between you and Allah, valid the moment it is meant. (Saying it at a mosque with witnesses is lovely for community and practical paperwork like Hajj visas later — but it is not what makes you Muslim.)

Know what you step into: everything before is erased. The Prophet ﷺ told Amr ibn al-As at his conversion: "Do you not know that Islam wipes out everything before it?" (Sahih Muslim 121) — you begin with a clean book, whatever the past held. A bath (ghusl) is recommended as a fresh start. Then go gently: learn to pray step by step, one prayer at a time; you are not expected to know everything on day one — the Companions themselves learned over years. "Allah does not burden a soul beyond its capacity" (2:286). Welcome home — the Prophet ﷺ described every newcomer to this faith exactly that way: returning to the fitrah you were born on.""",
        "sources": ["Sahih Muslim 121", "Quran 2:286, 39:53", "Sahih al-Bukhari 1358 (fitrah)"],
    },
    {
        "slug": "change-name-convert",
        "category": "new_muslim",
        "question": "Do I have to change my name when I become Muslim?",
        "tags": ["new-muslim", "identity"],
        "answer": """No. This is one of the most common misconceptions new Muslims face. The Companions who embraced Islam kept their names — Umar remained Umar, Salman remained Salman, Bilal remained Bilal; the Prophet ﷺ changed a name only when its actual meaning was religiously objectionable (e.g., "servant of [an idol]") or demeaning, and otherwise left names exactly as they were. Your name is your family's gift and your history; Islam honors lineage — the Prophet ﷺ forbade attributing oneself to other than one's own father (Sahih al-Bukhari 6768).

So David, Maria, Kenji or Priya can all remain — none of them means anything contrary to Islam. If your name literally means something polytheistic or shameful, scholars advise choosing an additional good name — and if you simply want a Muslim name as a marker of your new chapter, that is a beautiful choice, not an obligation. Many converts adopt one informally for the community while keeping legal names unchanged; both are fine. What Islam actually asks you to change is conduct, not identity: "Indeed Allah does not look at your appearances or your wealth, but He looks at your hearts and your deeds" (Sahih Muslim 2564).""",
        "sources": ["Sahih Muslim 2564", "Sahih al-Bukhari 6768", "IslamQA and mainstream fatwa: name change required only for objectionable meanings"],
    },
    {
        "slug": "telling-family-conversion",
        "category": "new_muslim",
        "question": "How do I tell my non-Muslim family I became Muslim?",
        "tags": ["new-muslim", "family"],
        "answer": """First, breathe: Islam does not ask you to choose between your faith and your family. The Quran addresses your exact situation — parents who may even actively oppose your Islam — and its instruction is stunning: "But if they strive to make you associate with Me that of which you have no knowledge, do NOT obey them — yet ACCOMPANY THEM IN THIS WORLD WITH KINDNESS" (31:15). Disagreement in creed, excellence in conduct. Sa'd ibn Abi Waqqas's mother starved herself to force him back; the verse came ordering him to stay both firm and gentle.

Practical wisdom from those who've walked it: choose a calm moment, not a holiday argument; lead with reassurance ("I'm still your child — this makes me MORE obligated to honor you, not less"); expect grief before acceptance — for many parents it initially lands as loss, and time plus your improved character is the argument no lecture matches. Answer questions simply, don't debate, and let them watch: serving them, visiting more, patience under provocation — the Prophet ﷺ won hearts this way for years in Makkah. If it goes badly at first, hold the line of kindness; countless converts report the same arc — shock, distance, curiosity, respect, and often, eventually, "whatever this is, it made you better." Keep making du'a; hidayah is Allah's work, not yours (28:56).""",
        "sources": ["Quran 31:14-15, 29:8, 28:56", "Sahih Muslim 1748 (story of Sa'd and his mother)"],
    },
    {
        "slug": "family-holidays-convert",
        "category": "new_muslim",
        "question": "Can I still attend my family's Christmas dinner and holidays?",
        "tags": ["new-muslim", "family", "fiqh"],
        "answer": """Here is the honest map of a question scholars genuinely discuss. All agree on the two ends: maintaining kind ties with non-Muslim family is obligatory (Quran 31:15 commands accompanying even parents who oppose your faith "with kindness"; Asma bint Abi Bakr was instructed by the Prophet ﷺ to maintain ties with her pagan mother — Sahih al-Bukhari 2620), and participating in the religious worship of another faith (church service, prayers, affirming its creed) is not permissible (109:6: "For you is your religion, and for me is mine").

Between those ends sits the family dinner. Many contemporary scholars and fatwa bodies serving Muslims in the West (e.g., positions associated with AMJA and scholars like Shaykh Abdullah bin Bayyah's school of thought) permit attending the family gathering as an act of kinship — eating (halal food), exchanging kindness, giving winter gifts — while abstaining from the specifically religious elements; they reason that severing family over a dinner harms Islam's own command of silat ar-rahim and closes hearts to the faith. Stricter opinions counsel avoiding the gathering itself. A workable path many converts take: be present for family, warm and helpful, skip the worship components, and host your own gatherings at Eid so the relationship flows both directions. Where your case is complicated, ask a knowledgeable local scholar — this is a question where circumstances legitimately change the answer.""",
        "sources": ["Quran 31:15, 109:6, 60:8", "Sahih al-Bukhari 2620", "Contemporary fatwa discussions (AMJA and Western fiqh councils)"],
    },
    {
        "slug": "cant-pray-five-times-yet",
        "category": "new_muslim",
        "question": "I can't manage all five prayers yet — am I failing?",
        "tags": ["new-muslim", "salah"],
        "answer": """You are not failing; you are climbing — and Islam's own pedagogy is gradual. The Quran was revealed over twenty-three years; alcohol was prohibited in stages; and the Prophet ﷺ instructed teachers: "Make things easy, do not make things hard; give glad tidings, do not repel" (Sahih al-Bukhari 69). Your five prayers are the goal, not the entry exam.

Practical ladder that has worked for thousands of converts: anchor ONE prayer first — usually Fajr or Isha, whichever your schedule protects — and pray it every day for two weeks, no matter what. Then add one more. A five-minute prayer prayed consistently outweighs an elaborate one abandoned: "The most beloved deeds to Allah are the most consistent, even if small" (Sahih al-Bukhari 6464). Can't recite yet? Learn al-Fatiha line by line (this app's Learn Quran course starts there); until you know it, say what you have — SubhanAllah, Alhamdulillah, Allahu Akbar — for jurists agree the learner does what he can (64:16: "Fear Allah as much as you are able"). Missed a prayer at work? Pray it when you can — late is infinitely better than never. And when you stumble, remember the door you entered by: every prayer you do make is a victory Allah sees, and "Allah does not waste the reward of the doers of good" (9:120).""",
        "sources": ["Sahih al-Bukhari 69, 6464", "Quran 64:16, 2:286, 9:120"],
    },
    {
        "slug": "marriage-after-conversion",
        "category": "new_muslim",
        "question": "I converted but my spouse hasn't — is my marriage still valid?",
        "tags": ["new-muslim", "marriage", "fiqh"],
        "answer": """It depends on the configuration, and this is a question to take to a real scholar with your specifics — but here is the framework. A man who embraces Islam while married to a Christian or Jewish wife: the marriage simply continues — such a marriage is valid in Islam from the outset (Quran 5:5). If his wife follows another religion, scholars discuss a waiting period during which her embrace of Islam (or, for some schools, of Christianity/Judaism) preserves the marriage.

A woman who embraces Islam while her husband remains non-Muslim is the harder case, and one classical and contemporary scholarship treats with real nuance: the traditional schools hold the marriage suspends — she waits out the idda (roughly three cycles), and if he embraces Islam within it the marriage continues; if not, it dissolves. Some contemporary jurists (notably positions discussed by the European Council for Fatwa and Research, drawing on early precedents like Umar's rulings and the delayed conversions of some Companions' spouses) allow a woman whose husband is kind and does not obstruct her religion to remain in the home awaiting his decision for an extended period, given the hardship of the alternative. Two anchors while you sort it out: do not rush into separation without scholarly counsel, and know that many converts' spouses — watching the change up close — later embrace Islam themselves; your patient example is da'wah no one else can give.""",
        "sources": ["Quran 5:5, 60:10", "Classical madhhab positions on the convert's marriage", "European Council for Fatwa and Research — resolutions on the convert wife"],
    },
    {
        "slug": "halal-food-basics",
        "category": "new_muslim",
        "question": "What are the actual food rules? What can I eat?",
        "tags": ["new-muslim", "halal", "daily-life"],
        "answer": """The default of food in Islam is permission — only a short list is forbidden: pork and its derivatives, blood, carrion (animals not properly slaughtered), animals dedicated to other than Allah, and intoxicants of any kind or quantity (Quran 2:173, 5:3, 5:90). Everything else — every fruit, vegetable, grain, dairy (rennet debates aside — mainstream fiqh permits standard cheese), and seafood by the majority position ("Lawful to you is the game of the sea" — 5:96; the Hanafi school limits sea creatures to fish) — is halal.

Meat is the practical question: beef, lamb and poultry require Islamic slaughter, and "the food of those given the Scripture is lawful for you" (5:5) — on the basis of which many scholars permit meat from Jewish (kosher) and, with conditions about actual slaughter method, Christian sources; other scholars require certified halal only. In practice: look for halal certification, use kosher as a widely accepted fallback, and when eating out choose seafood or vegetarian if unsure. Two mercies to hold: doubt does not poison the lawful — the Prophet ﷺ told a questioner unsure whether Allah's name was mentioned over meat: "Say Bismillah yourself and eat" (Sahih al-Bukhari 2057); and necessity lifts prohibition entirely when survival requires (2:173). Food rules are worship, not fear — "Eat of the good things and be grateful" (2:172).""",
        "sources": ["Quran 2:172-173, 5:3, 5:5, 5:90, 5:96", "Sahih al-Bukhari 2057"],
    },
    {
        "slug": "learning-to-pray",
        "category": "new_muslim",
        "question": "How do I learn to pray? It looks overwhelming.",
        "tags": ["new-muslim", "salah"],
        "answer": """Break it into what it actually is: a cycle (rak'ah) of five positions — standing, bowing, standing, prostrating twice — with short phrases at each. Learn ONE rak'ah and you know the whole prayer; the five daily prayers are just 2, 4, 4, 3 and 4 of that same cycle. Week one: learn the movements with transliterated phrases on paper in front of you (praying from a paper as a learner is fine). Week two: memorize the four-line opener al-Fatiha — a line a day; until it's memorized, jurists say recite what you know and glorify Allah in place of the rest (Sunan Abi Dawud 832 records the Prophet ﷺ teaching exactly this to a Companion who couldn't yet recite). Week three: the sitting declaration (tashahhud). That's 90% of it — refinements come for years, and that's normal.

Use the tools around you: this app's prayer times, qibla finder and Learn Quran course; pray behind others at any mosque (follow along — the congregation carries you); and know the standard everyone is judged by: "Fear Allah as much as you are ABLE" (64:16). Your stumbling, paper-reading, twice-restarted prayer may be more beloved to Allah than a scholar's — the Prophet ﷺ said the one who recites with difficulty receives DOUBLE reward (Sahih Muslim 798). The overwhelm is temporary; converts a few months ahead of you all say the same thing: one day it simply becomes yours.""",
        "sources": ["Sunan Abi Dawud 832", "Sahih Muslim 798", "Quran 64:16"],
    },
    {
        "slug": "wudu-hijab-at-work",
        "category": "new_muslim",
        "question": "How do I manage wudu, prayer and hijab at work or school?",
        "tags": ["new-muslim", "daily-life", "practical"],
        "answer": """All three have built-in flexibilities designed for exactly this. Wudu: do it at home before leaving — it lasts until broken, not until the next prayer; at work, a restroom sink is perfectly valid, and the sunnah of wiping over socks (khuffs) removes the awkward foot-in-sink problem: put socks on after a complete wudu, then for the next day (24 hours resident, 72 traveling) simply wipe damp hands over their tops instead of washing feet (Sahih Muslim 276 — the Prophet's ﷺ own practice).

Prayer: Dhuhr and Asr have windows of several hours — a 10-minute break somewhere in them suffices; a clean corner, office, stairwell or car works (the Prophet ﷺ: "The earth was made a mosque for me" — Sahih al-Bukhari 335); keep a small mat and pray in regular clothes — nothing special is required beyond covering. Most workplaces legally accommodate brief prayer breaks; asking quietly usually goes far better than converts fear. Hijab: no rule dictates style or fabric — professional, simple and comfortable fully satisfies the requirement (24:31); many sisters transition gradually, and consistency matters more than an overnight leap. Above all: "Whoever fears Allah, He makes for him a way out" (65:2) — thousands navigate a 9-to-5 with full deen daily; within months these logistics become as automatic as lunch.""",
        "sources": ["Sahih Muslim 276 (wiping over socks)", "Sahih al-Bukhari 335", "Quran 24:31, 65:2-3"],
    },
    {
        "slug": "keep-sinning-failure",
        "category": "new_muslim",
        "question": "I keep sinning and sliding back — am I a failure as a Muslim?",
        "tags": ["new-muslim", "repentance", "spirituality"],
        "answer": """Read the verse Allah revealed for exactly this despair: "Say: O My servants who have TRANSGRESSED AGAINST THEMSELVES, do not despair of the mercy of Allah — indeed, Allah forgives ALL sins. He is the Forgiving, the Merciful" (39:53). Scholars called it the most hope-filled verse in the Quran. The Prophet ﷺ defined the baseline of our species: "Every son of Adam sins constantly — and the best of those who sin are those who repent" (Jami' at-Tirmidhi 2499). Notice: the best are not the sinless (there are none); the best are the returners.

The design of tawba assumes repetition: the hadith of the man who sins, repents, sins again, repents again — and Allah declares, "My servant knows he has a Lord who forgives — I have forgiven him, let him do as he will" (Sahih al-Bukhari 7507, meaning: as long as he keeps returning). Your pattern — sin, regret, return — IS the believer's pattern; the losing pattern is only despair, because despair stops the returning. Practical footing: guard the five prayers even in your worst seasons (they erase what's between them — Sahih Muslim 233), change the environments that trigger the fall, keep one righteous companion, and never mistake the fight for the failure. The Prophet ﷺ said Allah rejoices at your repentance more than a man who finds his lost camel — with all his supplies — in the desert (Sahih Muslim 2747). You are not a failure. You are in the middle of the fight every saint was in.""",
        "sources": ["Quran 39:53, 3:135", "Jami' at-Tirmidhi 2499", "Sahih al-Bukhari 7507", "Sahih Muslim 233, 2747"],
    },
    # ── Modern life fiqh ────────────────────────────────────────────────
    {
        "slug": "mortgage-riba",
        "category": "modern_life",
        "question": "Can I take a mortgage? What's the problem with interest (riba)?",
        "tags": ["finance", "riba", "fiqh"],
        "answer": """Riba (interest) carries the Quran's most severe commercial warning: "Allah has permitted trade and forbidden riba… O you who believe, fear Allah and give up what remains of riba — and if you do not, then be informed of a WAR from Allah and His Messenger" (2:275-279). The logic: money earning money without work, trade or shared risk transfers wealth from the needy to the wealthy structurally — the lender wins whether the borrower thrives or drowns. Islam requires profit to be tied to risk and real assets.

For housing, Islamic finance builds ownership without lending at interest: murabaha (the bank buys the house and sells it to you at a disclosed markup on installments), ijara (rent-to-own), and diminishing musharaka (bank and buyer co-own; you buy out its share while paying rent on the remainder) — available in most Western countries through Islamic banks and windows. Where none exist, know the honest state of scholarship: the majority position holds conventional mortgages impermissible outside genuine necessity, while a minority — notably the European Council for Fatwa and Research (1999) — permitted them for Muslims in the West lacking alternatives, citing the need for stable housing (darura/haja) and the Hanafi view on contracts in non-Muslim lands. If you rely on that, meet its conditions: primary residence, no Islamic alternative genuinely accessible, and exit when one becomes available. And renting, scholars remind, is not a failure — it is a fully halal roof.""",
        "sources": ["Quran 2:275-279, 3:130", "European Council for Fatwa and Research, mortgage resolution (1999)", "AAOIFI standards on murabaha/ijara/musharaka"],
    },
    {
        "slug": "is-music-haram",
        "category": "modern_life",
        "question": "Is music haram in Islam?",
        "tags": ["music", "fiqh", "daily-life"],
        "answer": """This is a genuine, centuries-old scholarly disagreement — dishonesty in either direction ("obviously fine" / "obviously forbidden") misrepresents the tradition. The majority of classical jurists across the four schools prohibited musical instruments, citing the hadith condemning those who make lawful "ma'azif" (instruments) alongside silk and wine (Sahih al-Bukhari 5590) and verses interpreted about "idle talk that misleads from Allah's path" (31:6). Voice-only nasheeds and the duff (frame drum) at celebrations are permitted by broad agreement (the Prophet ﷺ allowed girls singing with a duff on Eid — Sahih al-Bukhari 952).

A minority with real scholarly weight disagreed: the Zahiri master Ibn Hazm rejected the prohibition's evidentiary basis, and jurists in that line — including contemporary voices like Shaykh al-Qaradawi — permit music whose content and context are wholesome, forbidding what glorifies sin or accompanies it. Practical guidance most scholars share regardless of camp: content matters enormously (lyrics celebrating intoxication or lust are problematic on ANY view); music that displaces prayer or Quran from your life is harming you measurably; and this is a question to resolve with knowledge and taqwa, not tribal mockery of the other position. Follow a qualified scholar you trust, respect Muslims who conclude differently — and let the Quran, not the playlist, be your heart's default soundtrack.""",
        "sources": ["Sahih al-Bukhari 5590, 952", "Quran 31:6 with its tafsir discussions", "Ibn Hazm, al-Muhalla; contemporary surveys of both positions"],
    },
    {
        "slug": "insurance-halal",
        "category": "modern_life",
        "question": "Is insurance halal?",
        "tags": ["finance", "insurance", "fiqh"],
        "answer": """The classical concern with commercial insurance is gharar — paying fixed premiums for a payout that may never come, or come multiplied — which resembles the uncertainty-trading the Prophet ﷺ forbade (Sahih Muslim 1513), sometimes compounded by insurers investing premiums in interest. On that basis the Islamic Fiqh Academy (OIC, Resolution 9, 1985) ruled conventional commercial insurance impermissible while endorsing the alternative: takaful — cooperative insurance where participants' contributions form a mutual pool, claims are paid from it as mutual aid, and surplus returns to members, mirroring the Quran's command to "cooperate in righteousness" (5:2) and the aqilah mutual-indemnity the Prophet ﷺ upheld.

The same councils carve out what reality imposes: insurance required by law — auto liability, employer-mandated coverage, and in many rulings health insurance where healthcare is otherwise unaffordable — is permissible on necessity, with the sin (if any) on the imposing system, not the compelled participant. Social/state insurance (pensions, national health) is broadly treated as a state benefits scheme, not a gharar contract. So the practical hierarchy: use takaful where it exists; take legally mandated coverage without guilt; for optional policies (life insurance especially), seek the takaful version or specific scholarly guidance — and remember insurance never replaces tawakkul, it only organizes the community's old duty to carry one another's disasters.""",
        "sources": ["Islamic Fiqh Academy (OIC) Resolution 9 (2/2), 1985", "Sahih Muslim 1513 (gharar)", "Quran 5:2", "AAOIFI takaful standards"],
    },
    {
        "slug": "crypto-stocks-halal",
        "category": "modern_life",
        "question": "Are stocks and cryptocurrency halal?",
        "tags": ["finance", "investing", "fiqh"],
        "answer": """Stocks: yes in principle — a share is part-ownership of a real business, exactly the risk-and-reward participation Islam endorses — with screening. The company's core business must be halal (no alcohol, gambling, conventional banking/insurance, pork, adult content, weapons for aggression), and its finances within tolerances scholars set for the modern world (AAOIFI-style screens: interest-bearing debt under ~30% of market cap, minimal interest income — with any tainted fraction of dividends given to charity as purification). Screened index funds and dedicated apps (following AAOIFI or equivalent methodologies) make this workable for ordinary savers. Day-trading with margin (an interest-bearing loan) and shorting borrowed shares fail the screens; long-term investing passes. Zakat applies to holdings annually.

Cryptocurrency: scholars are genuinely split, so hold your position with humility. Permitting voices treat established coins as digital assets/mediums of exchange (mal) — tradable at spot like currencies, with several national fatwa bodies and scholars approving; prohibiting voices (including Egypt's Dar al-Ifta and some Fiqh Academy discussions) cite extreme speculation, absence of backing, and use in crime. Points of wider agreement: leverage/margin trading and interest-bearing "staking-as-lending" products are impermissible; gambling-like meme speculation fails the maysir test regardless of the asset; and money you cannot afford to lose does not belong in it. Rule of thumb: real ownership, real assets, no interest, no gambling posture — then invest, and purify and pay zakat as you go.""",
        "sources": ["AAOIFI Sharia standards (equity screening)", "Quran 2:275, 5:90-91 (riba, maysir)", "Contemporary fatwa surveys on cryptocurrency (both positions)"],
    },
    {
        "slug": "organ-donation-islam",
        "category": "modern_life",
        "question": "Is organ donation allowed in Islam?",
        "tags": ["medicine", "fiqh"],
        "answer": """The major contemporary fiqh councils permit it — as an act the Quran's own idiom exalts: "Whoever saves a life, it is as if he saved all mankind" (5:32). The Islamic Fiqh Academy (OIC, Resolution 26, 1988) approved both living donation (where it doesn't gravely harm the donor — donating a kidney, part of a liver, blood) and cadaveric donation (with prior consent of the deceased or the family's), prohibiting only the SALE of organs — the body is a trust to give from, never a commodity. Similar rulings came from al-Azhar, the Saudi Council of Senior Scholars (Resolution 99, 1982), and for Western Muslims, detailed treatments like the UK's 2019 fatwa by Mufti Zubair Butt, which also works through brain-death criteria.

The instinctive objection — that the body is sacred and must return whole — is answered within the tradition itself: sanctity is precisely why donation is noble, giving from what is honored; jurists invoke the principle that necessity permits and that saving life outranks preserving tissue after death, just as eating carrion is permitted to the starving (2:173). A minority of scholars, particularly in the Indian subcontinent tradition, remain opposed — a position to respect. But the mainstream global verdict stands: donating is permitted and rewarded, receiving is permitted, and registering as a donor can be your final sadaqah — a stranger breathing, seeing or living through what you left behind.""",
        "sources": ["Quran 5:32, 2:173", "Islamic Fiqh Academy (OIC) Resolution 26 (1/4), 1988", "Saudi Senior Scholars Resolution 99 (1982); Mufti Zubair Butt, UK organ donation fatwa (2019)"],
    },
    {
        "slug": "vaccines-medicine-ingredients",
        "category": "modern_life",
        "question": "Are vaccines and medicines with questionable ingredients (gelatin, alcohol) permissible?",
        "tags": ["medicine", "halal", "fiqh"],
        "answer": """Yes, by the weight of contemporary scholarship — through principles the fiqh has always contained. Istihala (transformation): a substance chemically transformed into something new takes the new thing's ruling — porcine gelatin hydrolyzed beyond its origin, scholars of this view hold, is no longer "pork" any more than wine turned to vinegar is wine (a transformation the Prophet ﷺ himself validated for vinegar). Istihlak (dissolution): trace alcohol dissolved as a solvent, with no intoxicating trace in effect, does not render medicine "drink" — the prohibition targets intoxication, and syrup cannot intoxicate at any dose you could take. And overarching both: necessity and preventing harm — "He has not made for you in religion any hardship" (22:78); preserving life and health is among the Sharia's five objectives.

On vaccines specifically, the record is long and clear: the Islamic Fiqh Academy, al-Azhar, the Muslim World League and virtually every national fatwa body have approved routine and emergency vaccination — including where porcine-derived processing was involved — and scholars historically embraced inoculation early (Ottoman practice predated Europe's adoption). Protecting your children and the community from disease is not a concession Islam grudgingly makes; it is what the law's own purposes command. Individual medicines with actual intoxicating doses or valid halal alternatives are a different question — ask a scholar alongside your doctor. But do not let a gelatin capsule stand between you and health: the Lawgiver who forbade pork at the table commanded the cure at the pharmacy (Sahih al-Bukhari 5678).""",
        "sources": ["Quran 22:78, 2:173", "Sahih al-Bukhari 5678", "Islamic Fiqh Academy and Islamic Organization for Medical Sciences resolutions on istihala and vaccines"],
    },
    {
        "slug": "photos-social-media",
        "category": "modern_life",
        "question": "Are photographs, videos and social media haram? What about the hadith on image-makers?",
        "tags": ["daily-life", "fiqh", "technology"],
        "answer": """The severe hadiths about image-makers (Sahih al-Bukhari 5951: "Those who make these images will be punished on the Day of Resurrection — it will be said to them: give life to what you created") were understood by the scholars in their target: crafting idols and rivaling Allah's creation, in a world Islam was rescuing from the worship of handmade forms. On photography, contemporary scholarship overwhelmingly distinguishes: a photograph or video captures a reflection of what Allah already created — closer to a mirror than to a sculptor's rivalry — and the near-universal practice of today's scholars themselves (lecturing on YouTube, ID photos, video da'wah) reflects that settled conclusion. Statues and idol-craft remain prohibited; children's dolls were explicitly allowed even classically (Aisha (r.a.) played with them — Sahih al-Bukhari 6130).

The real fiqh of social media is the fiqh of the tongue and the gaze, scaled: backbiting is still backbiting with a share button (49:12), slander travels farther, the lustful gaze scrolls now (24:30), envy is manufactured by highlight reels, and hours evaporate — the Prophet ﷺ named FREE TIME one of the two blessings most people squander (Sahih al-Bukhari 6412). Post truth, verify before forwarding ("enough sin for a person to relate everything he hears" — Sahih Muslim intro), guard others' honor and your own modesty, and audit the ledger: an account that teaches, connects family or earns honestly is a tool; one that farms your outrage and your evenings is a landlord you're paying with your life.""",
        "sources": ["Sahih al-Bukhari 5951, 6130, 6412", "Quran 49:12, 24:30-31", "Contemporary fatwa consensus on photography"],
    },
    {
        "slug": "haram-job-bank-alcohol",
        "category": "modern_life",
        "question": "My job involves things Islam forbids (serving alcohol, interest-based banking) — what do I do?",
        "tags": ["work", "income", "fiqh"],
        "answer": """The scale runs from the directly forbidden to the merely proximate, and your obligation differs along it. Directly performing the haram is not made lawful by employment: the Prophet ﷺ cursed not only wine's drinker but its server, carrier and seller (Jami' at-Tirmidhi 1295), and likewise the consumer of riba, its payer, ITS SCRIBE AND ITS TWO WITNESSES (Sahih Muslim 1598) — so bartending, or a banking role that consists of writing interest contracts, needs an exit plan. But work merely adjacent to wrong — IT support in a bank's infrastructure, security at a supermarket that also sells beer, driving passengers who might buy wine — the majority of scholars treat differently: your wage is for permissible labor, and the sin of others' choices is theirs.

The path scholars prescribe is transition, not self-destruction: earning bread for your family is itself worship, and Islam does not command you into homelessness today — it commands the sincere pivot. Set the intention (Allah sees it — He "will make a way out" for the one who fears Him, 65:2-3), start the search, retrain if needed, take the pay cut when the halal door opens, and meanwhile minimize the forbidden components and keep asking forgiveness. Converts and repenters have walked this from every industry — and the consistent testimony matches the promise of 65:3: "He provides from where he never expected." Ask a scholar about your specific role; the difference between "core" and "adjacent" is exactly what fatwa exists for.""",
        "sources": ["Sahih Muslim 1598", "Jami' at-Tirmidhi 1295", "Quran 65:2-3", "Contemporary fatwa on employment in mixed industries (AMJA, IslamQA discussions)"],
    },
]
