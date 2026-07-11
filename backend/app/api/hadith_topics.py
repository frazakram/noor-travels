"""Topic → Bukhari chapter map (mirrors frontend/lib/hadith-topics.ts)."""

TOPIC_CHAPTERS: dict[str, list[str]] = {
    "prayer": [
        "Prayers (Salat)",
        "Call to Prayers (Adhaan)",
        "Ablutions (Wudu')",
        "Bathing (Ghusl)",
        "Times of the Prayers",
        "Friday Prayer",
        "Prayer at Night (Tahajjud)",
        "Praying at Night in Ramadaan (Taraweeh)",
        "Witr Prayer",
        "Rubbing hands and feet with dust (Tayammum)",
    ],
    "fasting": [
        "Fasting",
        "Praying at Night in Ramadaan (Taraweeh)",
        "Virtues of the Night of Qadr",
        "Retiring to a Mosque for Remembrance of Allah (I'tikaf)",
    ],
    "zakat": [
        "Obligatory Charity Tax (Zakat)",
        "Gifts",
        "One-fifth of Booty to the Cause of Allah (Khumus)",
    ],
    "hajj": [
        "Hajj (Pilgrimage)",
        "`Umrah (Minor pilgrimage)",
        "Pilgrims Prevented from Completing the Pilgrimage",
        "Penalty of Hunting while on Pilgrimage",
    ],
    "family": [
        "Wedlock, Marriage (Nikaah)",
        "Divorce",
        "Supporting the Family",
        "Funerals (Al-Janaa'iz)",
    ],
    "character": [
        "Good Manners and Form (Al-Adab)",
        "To make the Heart Tender (Ar-Riqaq)",
        "Knowledge",
        "Asking Permission",
    ],
    "trade": [
        "Sales and Trade",
        "Loans, Payment of Loans, Freezing of Property, Bankruptcy",
        "Partnership",
        "Hiring",
    ],
    "daily": [
        "Food, Meals",
        "Drinks",
        "Dress",
        "Medicine",
        "Hunting, Slaughtering",
    ],
    "faith": [
        "Belief",
        "Oneness, Uniqueness of Allah (Tawheed)",
        "Virtues of the Qur'an",
        "Holding Fast to the Qur'an and Sunnah",
    ],
    "duas": ["Invocations", "Invoking Allah for Rain (Istisqaa)"],
    "prophets": [
        "Prophets",
        "Prophetic Commentary on the Qur'an (Tafseer of the Prophet (pbuh))",
        "Virtues and Merits of the Prophet (pbuh) and his Companions",
        "Beginning of Creation",
    ],
    "striving": [
        "Fighting for the Cause of Allah (Jihaad)",
        "Limits and Punishments set by Allah (Hudood)",
        "Judgments (Ahkaam)",
        "Oaths and Vows",
    ],
}


def chapters_for_topic(topic: str) -> list[str] | None:
    return TOPIC_CHAPTERS.get(topic)
