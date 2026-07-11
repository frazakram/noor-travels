/** Curated Bukhari chapter groupings for browse-by-topic UI */

export type HadithTopic = {
  id: string;
  icon: string;
  chapters: string[];
};

export const HADITH_TOPICS: HadithTopic[] = [
  {
    id: "prayer",
    icon: "🕌",
    chapters: [
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
  },
  {
    id: "fasting",
    icon: "🌙",
    chapters: [
      "Fasting",
      "Praying at Night in Ramadaan (Taraweeh)",
      "Virtues of the Night of Qadr",
      "Retiring to a Mosque for Remembrance of Allah (I'tikaf)",
    ],
  },
  {
    id: "zakat",
    icon: "💝",
    chapters: [
      "Obligatory Charity Tax (Zakat)",
      "Gifts",
      "One-fifth of Booty to the Cause of Allah (Khumus)",
    ],
  },
  {
    id: "hajj",
    icon: "🕋",
    chapters: [
      "Hajj (Pilgrimage)",
      "`Umrah (Minor pilgrimage)",
      "Pilgrims Prevented from Completing the Pilgrimage",
      "Penalty of Hunting while on Pilgrimage",
    ],
  },
  {
    id: "family",
    icon: "👨‍👩‍👧",
    chapters: [
      "Wedlock, Marriage (Nikaah)",
      "Divorce",
      "Supporting the Family",
      "Funerals (Al-Janaa'iz)",
    ],
  },
  {
    id: "character",
    icon: "✨",
    chapters: [
      "Good Manners and Form (Al-Adab)",
      "To make the Heart Tender (Ar-Riqaq)",
      "Knowledge",
      "Asking Permission",
    ],
  },
  {
    id: "trade",
    icon: "🤝",
    chapters: [
      "Sales and Trade",
      "Loans, Payment of Loans, Freezing of Property, Bankruptcy",
      "Partnership",
      "Hiring",
    ],
  },
  {
    id: "daily",
    icon: "🍽️",
    chapters: ["Food, Meals", "Dress", "Drinks", "Medicine", "Hunting, Slaughtering"],
  },
  {
    id: "faith",
    icon: "📿",
    chapters: [
      "Belief",
      "Oneness, Uniqueness of Allah (Tawheed)",
      "Virtues of the Qur'an",
      "Holding Fast to the Qur'an and Sunnah",
    ],
  },
  {
    id: "duas",
    icon: "🤲",
    chapters: ["Invocations", "Invoking Allah for Rain (Istisqaa)"],
  },
  {
    id: "prophets",
    icon: "📖",
    chapters: [
      "Prophets",
      "Prophetic Commentary on the Qur'an (Tafseer of the Prophet (pbuh))",
      "Virtues and Merits of the Prophet (pbuh) and his Companions",
      "Beginning of Creation",
    ],
  },
  {
    id: "striving",
    icon: "⚖️",
    chapters: [
      "Fighting for the Cause of Allah (Jihaad)",
      "Limits and Punishments set by Allah (Hudood)",
      "Judgments (Ahkaam)",
      "Oaths and Vows",
    ],
  },
];

export function topicById(id: string): HadithTopic | undefined {
  return HADITH_TOPICS.find((t) => t.id === id);
}
