export type PrayerId = "fajr" | "dhuhr" | "asr" | "maghrib" | "isha";

export type PrayerSlot = {
  id: PrayerId;
  start: string;
  end: string;
};

export type SalahTimesResponse = {
  date: string;
  hijri?: {
    date?: string;
    day?: string;
    month?: { number?: number; en?: string; ar?: string };
    year?: string;
    holidays?: string[];
  };
  timezone: string;
  latitude: number;
  longitude: number;
  method: number;
  school: number;
  timings: Record<string, string>;
  prayers: PrayerSlot[];
};

export type LocationResponse = {
  label: string;
  locality: string;
  region: string;
  country: string;
  display_name: string;
  latitude: number;
  longitude: number;
};

export type LocationSearchResult = {
  label: string;
  display_name: string;
  latitude: number;
  longitude: number;
};

export type PrayerOffsets = Record<PrayerId, number>;

export type SalahSettings = {
  method: number;
  school: 0 | 1;
  /** Per-prayer minute adjustments to match the local masjid timetable. */
  offsets: PrayerOffsets;
  /**
   * Aladhan latitudeAdjustmentMethod for high latitudes:
   * 1 Middle of Night, 2 One Seventh, 3 Angle Based (default for polar).
   * 0 / undefined = none (standard).
   */
  latitudeAdjustment?: 0 | 1 | 2 | 3;
};

export const DEFAULT_PRAYER_OFFSETS: PrayerOffsets = {
  fajr: 0,
  dhuhr: 0,
  asr: 0,
  maghrib: 0,
  isha: 0,
};

export const DEFAULT_SALAH_SETTINGS: SalahSettings = {
  method: 1,
  school: 1,
  offsets: DEFAULT_PRAYER_OFFSETS,
  latitudeAdjustment: 0,
};

export const HIGH_LATITUDE_METHODS = [
  { id: 0 as const, labelKey: "highLatNone" as const },
  { id: 1 as const, labelKey: "highLatMiddleNight" as const },
  { id: 2 as const, labelKey: "highLatOneSeventh" as const },
  { id: 3 as const, labelKey: "highLatAngleBased" as const },
];

export const PRAYER_METHODS = [
  { id: 1, label: "Karachi" },
  { id: 2, label: "ISNA" },
  { id: 3, label: "Muslim World League" },
  { id: 4, label: "Umm al-Qura" },
  { id: 5, label: "Egyptian Authority" },
  { id: 7, label: "Tehran" },
  { id: 8, label: "Gulf Region" },
  { id: 12, label: "France" },
  { id: 13, label: "Turkey" },
  { id: 14, label: "Russia" },
  { id: 15, label: "Moonsighting Committee" },
] as const;

export type TimePhase = "fajr" | "morning" | "dhuhr" | "asr" | "maghrib" | "isha" | "night";

const PRAYER_ORDER: PrayerId[] = ["fajr", "dhuhr", "asr", "maghrib", "isha"];

/** Minutes since midnight in IANA timezone. */
export function minutesInTz(date: Date, tz: string): number {
  const s = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
}

export function parseMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** Shift HH:mm by ±minutes, wrapping over midnight. */
export function shiftTime(time: string, minutes: number): string {
  if (!time || !Number.isFinite(minutes) || minutes === 0) return time;
  const total = ((parseMinutes(time) + minutes) % (24 * 60) + 24 * 60) % (24 * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Format HH:mm for display (keeps 24h; UI can wrap with locale later). */
export function formatPrayerClock(time: string): string {
  if (!time || !time.includes(":")) return time;
  return time.slice(0, 5);
}

/** Ms until target HH:mm today or tomorrow in timezone. */
export function msUntilTime(time: string, tz: string, now = new Date()): number {
  const nowMin = minutesInTz(now, tz);
  const targetMin = parseMinutes(time);
  let diffMin = targetMin - nowMin;
  if (diffMin <= 0) diffMin += 24 * 60;
  return diffMin * 60_000;
}

export function formatCountdown(ms: number): string {
  if (ms <= 0) return "00:00:00";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export type NextPrayerInfo = {
  current: PrayerId | null;
  next: PrayerId;
  countdownMs: number;
  progress: number;
};

function isInPrayerWindow(startMin: number, endMin: number, nowMin: number): boolean {
  if (endMin > startMin) {
    return nowMin >= startMin && nowMin < endMin;
  }
  // Window crosses midnight (e.g. Isha 20:08 → 00:23)
  return nowMin >= startMin || nowMin < endMin;
}

export function getNextPrayer(prayers: PrayerSlot[], tz: string, now = new Date()): NextPrayerInfo {
  const nowMin = minutesInTz(now, tz);

  const slots = PRAYER_ORDER.map((id) => {
    const p = prayers.find((x) => x.id === id)!;
    return { id, startMin: parseMinutes(p.start), endMin: parseMinutes(p.end) };
  });

  let current: PrayerId | null = null;
  for (const s of slots) {
    if (isInPrayerWindow(s.startMin, s.endMin, nowMin)) {
      current = s.id;
      break;
    }
  }

  let next: PrayerId = "fajr";
  let countdownMs = msUntilTime(prayers.find((p) => p.id === "fajr")!.start, tz, now);

  for (const s of slots) {
    if (nowMin < s.startMin) {
      next = s.id;
      countdownMs = (s.startMin - nowMin) * 60_000;
      break;
    }
  }

  const currentSlot = current ? slots.find((s) => s.id === current)! : null;
  let progress = 0;
  if (currentSlot) {
    const windowStart = currentSlot.startMin;
    let windowEnd = currentSlot.endMin;
    let n = nowMin;
    if (windowEnd <= windowStart) {
      windowEnd += 24 * 60;
      if (n < windowStart) n += 24 * 60;
    }
    const total = Math.max(1, windowEnd - windowStart);
    progress = Math.min(1, Math.max(0, (n - windowStart) / total));
  }

  return { current, next, countdownMs, progress };
}

export function getTimePhase(prayers: PrayerSlot[] | null, tz: string, now = new Date()): TimePhase {
  if (prayers) {
    const info = getNextPrayer(prayers, tz, now);
    if (info.current) return info.current;
    const hour = Number(
      new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "numeric", hour12: false }).format(now),
    );
    if (hour >= 21 || hour < 4) return "night";
    return info.next === "fajr" ? "night" : "morning";
  }
  const hour = now.getHours();
  if (hour >= 5 && hour < 7) return "fajr";
  if (hour >= 7 && hour < 12) return "morning";
  if (hour >= 12 && hour < 15) return "dhuhr";
  if (hour >= 15 && hour < 18) return "asr";
  if (hour >= 18 && hour < 20) return "maghrib";
  if (hour >= 20 && hour < 22) return "isha";
  return "night";
}

export const MOTIVATIONS: Record<string, Record<TimePhase, string[]>> = {
  en: {
    fajr: [
      "The two rak'ahs before Fajr are better than the world and all it contains.",
      "Angels witness the congregation at Fajr — begin your day with light.",
    ],
    morning: [
      "Remember Allah in the morning — blessings follow a grateful heart.",
      "Walk to the masjid with hope; every step can erase a sin.",
    ],
    dhuhr: [
      "Pause from the world at Dhuhr — your soul needs this rest.",
      "The believer is never alone; prayer is direct conversation with Allah.",
    ],
    asr: [
      "Guard the middle prayer — those who preserve Asr are among the successful.",
      "As the day cools, renew your focus on the Hereafter.",
    ],
    maghrib: [
      "Break your fast with dates and water; break your heedlessness with gratitude.",
      "Maghrib is a door of mercy — do not miss it.",
    ],
    isha: [
      "End your day in prostration — sleep with a light heart.",
      "The night prayer is the honor of the believer.",
    ],
    night: [
      "Tahajjud is for those who seek closeness — even a few rak'ahs matter.",
      "The last third of the night is when duas are answered.",
    ],
  },
  ur: {
    fajr: [
      "فجر سے پہلے دو رکعت دنیا و مافیا سے بہتر ہیں۔",
      "فجر کی جماعت پر فرشتے گواہی دیتے ہیں — دن نور سے شروع کریں۔",
    ],
    morning: [
      "صبح اللہ کا ذکر کریں — شکر گزار دل پر برکتیں نازل ہوتی ہیں۔",
      "مسجد کی طرف قدم بڑھائیں — ہر قدم گناہ مٹا سکتا ہے۔",
    ],
    dhuhr: [
      "ظہر پر دنیا سے وقفہ لیں — روح کو آرام چاہیے۔",
      "نماز اللہ سے براہِ راست بات ہے۔",
    ],
    asr: [
      "وسطی نماز (عصر) کی حفاظت کرو — کامیاب وہی ہیں۔",
      "جب دن ڈھلتا ہے، آخرت کی یاد تازہ کرو۔",
    ],
    maghrib: [
      "مغرب کے وقت شکر ادا کرو — رحمت کا دروازہ ہے۔",
      "مغرب کی نماز نہ چھوڑیں۔",
    ],
    isha: [
      "دن سجدے میں ختم کرو — دل ہلکا ہو کر سوئیں۔",
      "عشاء مومن کی عزت ہے۔",
    ],
    night: [
      "تہجد قربت چاہنے والوں کے لیے ہے۔",
      "رات کا آخری حصہ دعاؤں کے قبول کا وقت ہے۔",
    ],
  },
  hi: {
    fajr: [
      "फज्र से पहले दो रकअत दुनिया व माफ़ीहा से बेहतर हैं।",
      "फज्र की जमाअत पर फ़रिश्ते गवाही देते हैं।",
    ],
    morning: [
      "सुबह अल्लाह का ज़िक्र करें — शुक्रगुज़ार दिल पर बरकतें।",
      "मस्जिद की तरफ़ कदम बढ़ाएँ — हर कदम गुनाह मिटा सकता है।",
    ],
    dhuhr: [
      "ज़ुहर पर दुनिया से विराम लें — रूह को आराम चाहिए।",
      "नमाज़ अल्लाह से सीधी बातचीत है।",
    ],
    asr: [
      "असर की नमाज़ की हिफ़ाज़त करो — कामयाब वही हैं।",
      "जब दिन ढलता है, आख़िरत की याद ताज़ा करो।",
    ],
    maghrib: [
      "मग़रिब के वक़्त शुक्र अदा करो — रहमत का दरवाज़ा है।",
      "मग़रिब की नमाज़ न छोड़ें।",
    ],
    isha: [
      "दिन सजदे में खत्म करो — दिल हल्का होकर सोएँ।",
      "इशा मोमिन की इज़्ज़त है।",
    ],
    night: [
      "तहज्जुद क़ुर्बत चाहने वालों के लिए है।",
      "रात का आख़िरी हिस्सा दुआओं के क़बूल का वक़्त है।",
    ],
  },
};

export function pickMotivation(lang: string, phase: TimePhase, seed: number): string {
  const pool = MOTIVATIONS[lang]?.[phase] ?? MOTIVATIONS.en[phase];
  return pool[seed % pool.length];
}

export function qiblaBearing(lat: number, lng: number): number {
  const kaabaLat = (21.422487 * Math.PI) / 180;
  const kaabaLng = (39.826206 * Math.PI) / 180;
  const phi = (lat * Math.PI) / 180;
  const lambda = (lng * Math.PI) / 180;
  const y = Math.sin(kaabaLng - lambda);
  const x = Math.cos(phi) * Math.tan(kaabaLat) - Math.sin(phi) * Math.cos(kaabaLng - lambda);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

export function upcomingHijriEvent(hijri?: SalahTimesResponse["hijri"]): string {
  const month = hijri?.month?.number;
  const day = Number(hijri?.day);
  if (!month || !day) return "Islamic date loaded";
  const events = [
    { month: 1, day: 10, name: "Ashura" },
    { month: 8, day: 15, name: "15th Sha'ban" },
    { month: 9, day: 1, name: "Ramadan begins" },
    { month: 9, day: 27, name: "Laylatul Qadr (commonly observed)" },
    { month: 10, day: 1, name: "Eid al-Fitr" },
    { month: 12, day: 9, name: "Day of Arafah" },
    { month: 12, day: 10, name: "Eid al-Adha" },
  ];
  const current = month * 40 + day;
  const next = events.find((e) => e.month * 40 + e.day >= current) ?? events[0];
  const days = next.month >= month ? (next.month - month) * 30 + (next.day - day) : (12 - month + next.month) * 30 + (next.day - day);
  if (days <= 0) return next.name;
  return `${days} day${days === 1 ? "" : "s"} until ${next.name}`;
}
