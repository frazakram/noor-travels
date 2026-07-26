export type LearnQuranIndex = {
  modules: LearnModule[];
  meta: {
    version: number;
    total_modules: number;
    total_lessons: number;
    total_vocabulary: number;
    target_coverage_pct: number;
    sources: {
      version: number;
      methodology?: string;
      sources: {
        id: string;
        title_en: string;
        author?: string;
        institution?: string;
        url?: string;
        role: string;
      }[];
      disclaimer_en?: string;
    };
  };
};

export type LearnModule = {
  id: string;
  order: number;
  title_en: string;
  title_ur: string;
  title_hi: string;
  desc_en: string;
  icon: string;
  lesson_ids: string[];
};

export type VocabWord = {
  ar: string;
  tr: string;
  en: string;
  ur: string;
  hi: string;
  freq: number;
  root?: string;
  examples?: { verse_key: string; snippet: string }[];
};

export type VocabLesson = {
  id: string;
  module_id: string;
  order: number;
  type: "vocabulary";
  title_en: string;
  title_ur: string;
  title_hi: string;
  coverage_pct: number;
  intro_en: string;
  words: VocabWord[];
  quiz: {
    type: string;
    prompt_ar?: string;
    prompt_en: string;
    options: string[];
    answer: number;
  }[];
};

export type GrammarLesson = {
  id: string;
  module_id: string;
  order: number;
  type: "grammar";
  title_en: string;
  title_ur: string;
  title_hi: string;
  intro_en: string;
  sections: {
    heading_en: string;
    body_en: string;
    examples: { ar: string; en: string; note?: string }[];
  }[];
  practice: { q_en: string; options: string[]; answer: number }[];
};

export type RootsLesson = {
  id: string;
  module_id: string;
  order: number;
  type: "roots";
  title_en: string;
  title_ur: string;
  title_hi: string;
  intro_en: string;
  roots: { root: string; words: { ar: string; en: string }[] }[];
  practice_ayah: string;
};

export type ReadingVerse = {
  verse_key: string;
  arabic: string;
  translation_en: string;
  translation_ur: string;
  words: { ar: string; tr: string; en: string }[];
};

export type ReadingLesson = {
  id: string;
  module_id: string;
  order: number;
  type: "reading";
  title_en: string;
  title_ur: string;
  title_hi: string;
  verse_keys: string[];
  hide_translation_after: number;
  verses: ReadingVerse[];
};

export type LearnLesson = VocabLesson | GrammarLesson | RootsLesson | ReadingLesson;

const PROGRESS_KEY = "noor-learn-quran-progress";

export type LessonProgress = {
  completed: boolean;
  score?: number;
  lastStudied?: string;
  placed?: boolean;
};

export type PlacementResult = {
  date: string;
  perModule: Record<string, { correct: number; total: number }>;
  placedModuleId: string;
  pointsAwarded: number;
};

export type LearnProgress = {
  lessons: Record<string, LessonProgress>;
  streak: number;
  lastStudyDate?: string;
  points: number;
  placement?: PlacementResult;
  /** badgeId → ISO date earned */
  badges?: Record<string, string>;
  /** moduleId → best module-quiz score % */
  moduleQuizzes?: Record<string, number>;
};

export function loadProgress(): LearnProgress {
  if (typeof window === "undefined") {
    return { lessons: {}, streak: 0, points: 0 };
  }
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return { lessons: {}, streak: 0, points: 0 };
    const parsed = JSON.parse(raw) as LearnProgress;
    if (typeof parsed.points !== "number") parsed.points = 0;
    return parsed;
  } catch {
    return { lessons: {}, streak: 0, points: 0 };
  }
}

export function saveProgress(progress: LearnProgress): void {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    // Storage full or private-browsing mode — keep the session working
    // in memory rather than crashing the finish-lesson flow.
  }
}

function lessonPoints(score?: number): number {
  // 10 for finishing, up to +10 for quiz performance.
  return 10 + Math.round((score ?? 0) / 10);
}

export function markLessonComplete(lessonId: string, score?: number): LearnProgress {
  const progress = loadProgress();
  const today = new Date().toISOString().slice(0, 10);
  const last = progress.lastStudyDate;
  let streak = progress.streak;
  if (last !== today) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const ystr = yesterday.toISOString().slice(0, 10);
    streak = last === ystr ? streak + 1 : 1;
  }
  // Points only ever go up: redoing a lesson pays out the improvement.
  const prev = progress.lessons[lessonId];
  const prevPts = prev?.completed && !prev.placed ? lessonPoints(prev.score) : 0;
  progress.points += Math.max(0, lessonPoints(score) - prevPts);
  progress.lessons[lessonId] = {
    completed: true,
    score,
    lastStudied: new Date().toISOString(),
  };
  progress.streak = streak;
  progress.lastStudyDate = today;
  // Lightweight badges
  const badges = { ...(progress.badges ?? {}) };
  if (!badges.first_lesson) badges.first_lesson = today;
  if ((score ?? 0) >= 100 && !badges.perfect_quiz) badges.perfect_quiz = today;
  if (streak >= 7 && !badges.streak_7) badges.streak_7 = today;
  progress.badges = badges;
  saveProgress(progress);
  void import("@/lib/auth").then((m) => m.scheduleProgressPush(progress)).catch(() => undefined);
  return progress;
}

export function awardModuleBadge(moduleId: string, score: number): LearnProgress {
  const progress = loadProgress();
  const today = new Date().toISOString().slice(0, 10);
  const quizzes = { ...(progress.moduleQuizzes ?? {}) };
  quizzes[moduleId] = Math.max(quizzes[moduleId] ?? 0, score);
  progress.moduleQuizzes = quizzes;
  const badges = { ...(progress.badges ?? {}) };
  if (score >= 70) {
    badges[`module:${moduleId}`] = badges[`module:${moduleId}`] ?? today;
    progress.points += score >= 90 ? 25 : 15;
  }
  progress.badges = badges;
  saveProgress(progress);
  void import("@/lib/auth").then((m) => m.scheduleProgressPush(progress)).catch(() => undefined);
  return progress;
}

export function isModuleComplete(progress: LearnProgress, module: LearnModule): boolean {
  return module.lesson_ids.every((id) => progress.lessons[id]?.completed);
}

export type BadgeDef = {
  id: string;
  icon: string;
  title_en: string;
  title_ur: string;
  title_hi: string;
};

export const BADGE_DEFS: BadgeDef[] = [
  { id: "first_lesson", icon: "🌟", title_en: "First lesson", title_ur: "پہلا سبق", title_hi: "पहला पाठ" },
  { id: "perfect_quiz", icon: "💯", title_en: "Perfect quiz", title_ur: "کامل کوئز", title_hi: "पूर्ण क्विज़" },
  { id: "streak_7", icon: "🔥", title_en: "7-day streak", title_ur: "۷ دن کا سلسلہ", title_hi: "७-दिन की लकीर" },
];

export function badgeTitle(b: BadgeDef, lang: string): string {
  if (lang === "ur") return b.title_ur;
  if (lang === "hi") return b.title_hi;
  return b.title_en;
}

// ── Levels ──────────────────────────────────────────────────────────────

export type LearnLevel = {
  min: number;
  title_en: string;
  title_ur: string;
  title_hi: string;
  icon: string;
};

export const LEVELS: LearnLevel[] = [
  { min: 0, title_en: "Mubtadi — Beginner", title_ur: "مبتدی", title_hi: "मुब्तदी — शुरुआती", icon: "🌱" },
  { min: 100, title_en: "Talib — Seeker", title_ur: "طالبِ علم", title_hi: "तालिब — विद्यार्थी", icon: "🔍" },
  { min: 250, title_en: "Qari — Reader", title_ur: "قاری", title_hi: "क़ारी — पाठक", icon: "📖" },
  { min: 450, title_en: "Mutadabbir — Reflector", title_ur: "متدبر", title_hi: "मुतदब्बिर — चिंतक", icon: "💡" },
  { min: 700, title_en: "Mutqin — Accomplished", title_ur: "متقن", title_hi: "मुत्क़िन — निपुण", icon: "🏆" },
];

export function levelForPoints(points: number): { level: LearnLevel; index: number; next: LearnLevel | null } {
  let index = 0;
  for (let i = 0; i < LEVELS.length; i++) {
    if (points >= LEVELS[i].min) index = i;
  }
  return { level: LEVELS[index], index, next: LEVELS[index + 1] ?? null };
}

export function levelTitle(level: LearnLevel, lang: string): string {
  if (lang === "ur") return level.title_ur;
  if (lang === "hi") return level.title_hi;
  return level.title_en;
}

// ── Universal quiz generation (for the placement test) ─────────────────

export type TestQuestion = {
  prompt_ar?: string;
  prompt_en: string;
  options: string[];
  answer: number;
};

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const GLOSS_STOPWORDS = new Set([
  "he", "she", "it", "they", "we", "you", "i", "the", "a", "an", "of", "to",
  "in", "on", "for", "and", "or", "not", "no", "his", "her", "their", "is",
  "was", "who", "one", "all",
]);

function contentWords(gloss: string): Set<string> {
  return new Set(
    gloss
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter((w) => w.length >= 3 && !GLOSS_STOPWORDS.has(w)),
  );
}

/** Two glosses "collide" when they share a meaningful word — offering
 *  "he came; brought" as a distractor for "he came" makes two answers right. */
function glossesCollide(a: string, b: string): boolean {
  const wa = contentWords(a);
  for (const w of contentWords(b)) if (wa.has(w)) return true;
  return false;
}

function meaningQuestion(ar: string, correct: string, pool: string[]): TestQuestion | null {
  if (!correct) return null;
  const unique = [...new Set(pool.filter((p) => p && p !== correct))];
  const safe = unique.filter((p) => !glossesCollide(p, correct));
  // A slightly shorter option list beats a question with two right answers.
  const distractors = shuffled(safe).slice(0, 3);
  if (distractors.length < 2) return null;
  const options = shuffled([correct, ...distractors]);
  return {
    prompt_ar: ar,
    prompt_en: "What does this mean?",
    options,
    answer: options.indexOf(correct),
  };
}

/** Build quiz questions from any lesson type — roots and reading lessons
 *  have no authored quiz, so derive one from their word glosses. */
export function questionsForLesson(lesson: LearnLesson): TestQuestion[] {
  if (lesson.type === "vocabulary") {
    return lesson.quiz.map((q) => ({
      prompt_ar: q.prompt_ar,
      prompt_en: q.prompt_en,
      options: q.options,
      answer: q.answer,
    }));
  }
  if (lesson.type === "grammar") {
    return lesson.practice.map((p) => ({ prompt_en: p.q_en, options: p.options, answer: p.answer }));
  }
  if (lesson.type === "roots") {
    const all = dedupeByAr(lesson.roots.flatMap((r) => r.words));
    const pool = all.map((w) => w.en);
    return all
      .map((w) => meaningQuestion(w.ar, w.en, pool))
      .filter((q): q is TestQuestion => q !== null);
  }
  // reading: quiz the word-by-word glosses (a surah repeats words — ask once)
  const words = dedupeByAr(lesson.verses.flatMap((v) => v.words).filter((w) => w.en.length > 2));
  const pool = words.map((w) => w.en);
  return words
    .map((w) => meaningQuestion(w.ar, w.en, pool))
    .filter((q): q is TestQuestion => q !== null);
}

function dedupeByAr<T extends { ar: string }>(words: T[]): T[] {
  const seen = new Set<string>();
  return words.filter((w) => {
    const key = w.ar.replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── Arabic script reading check ─────────────────────────────────────────
// The course assumes the learner already reads Arabic script. These ask
// "how is this word read?" — decodable only by actually reading the
// letters and harakat, not by knowing meanings. Correct option first;
// buildReadingCheck shuffles.

export const SCRIPT_CHECK_MODULE_ID = "script-check";

const READING_CHECK: { ar: string; options: string[] }[] = [
  { ar: "كَتَبَ", options: ["kataba", "kutiba", "kitāb", "kātib"] },
  { ar: "بِسْمِ", options: ["bismi", "basama", "sibmi", "bimsi"] },
  { ar: "نُور", options: ["nūr", "rūn", "nawra", "nīr"] },
  { ar: "قَمَر", options: ["qamar", "qimar", "maqar", "qumur"] },
  { ar: "يَوْم", options: ["yawm", "yumā", "wayam", "yamū"] },
  { ar: "كِتَاب", options: ["kitāb", "kutub", "kātib", "kabit"] },
  { ar: "مُسْلِم", options: ["muslim", "maslam", "salima", "musallam"] },
  { ar: "رَحِيم", options: ["raḥīm", "raḥmān", "ḥakīm", "rāḥim"] },
  { ar: "عَلِمَ", options: ["ʿalima", "ʿāmila", "ʿilmun", "ʿamal"] },
  { ar: "شَمْس", options: ["shams", "samash", "mashs", "shimās"] },
];

export function buildReadingCheck(n = 5): TestQuestion[] {
  return shuffled(READING_CHECK)
    .slice(0, n)
    .map((q) => {
      const correct = q.options[0];
      const options = shuffled(q.options);
      return {
        prompt_ar: q.ar,
        prompt_en: "How is this word read?",
        options,
        answer: options.indexOf(correct),
      };
    });
}

/** Sample n questions per module for the placement test. */
export function buildPlacementTest(
  index: LearnQuranIndex,
  lessons: Record<string, LearnLesson>,
  perModule = 3,
): { moduleId: string; question: TestQuestion }[] {
  const out: { moduleId: string; question: TestQuestion }[] = [];
  for (const mod of [...index.modules].sort((a, b) => a.order - b.order)) {
    const pool = mod.lesson_ids
      .map((id) => lessons[id])
      .filter(Boolean)
      .flatMap((l) => questionsForLesson(l));
    for (const q of shuffled(pool).slice(0, perModule)) {
      out.push({ moduleId: mod.id, question: q });
    }
  }
  return out;
}

/** Apply a placement: mark all lessons before the placed module as done. */
export function applyPlacement(
  index: LearnQuranIndex,
  perModule: Record<string, { correct: number; total: number }>,
  placedModuleId: string,
  correctTotal: number,
): LearnProgress {
  const progress = loadProgress();
  const ordered = [...index.modules].sort((a, b) => a.order - b.order);
  for (const mod of ordered) {
    if (mod.id === placedModuleId) break;
    for (const id of mod.lesson_ids) {
      if (!progress.lessons[id]?.completed) {
        progress.lessons[id] = { completed: true, placed: true, lastStudied: new Date().toISOString() };
      }
    }
  }
  // Test points: 2 per correct, but retakes only pay the improvement.
  const newAward = correctTotal * 2;
  const prevAward = progress.placement?.pointsAwarded ?? 0;
  progress.points += Math.max(0, newAward - prevAward);
  progress.placement = {
    date: new Date().toISOString(),
    perModule,
    placedModuleId,
    pointsAwarded: Math.max(newAward, prevAward),
  };
  saveProgress(progress);
  void import("@/lib/auth").then((m) => m.scheduleProgressPush(progress)).catch(() => undefined);
  return progress;
}

export function moduleTitle(mod: LearnModule, lang: string): string {
  if (lang === "ur") return mod.title_ur;
  if (lang === "hi") return mod.title_hi;
  return mod.title_en;
}

export function lessonTitle(lesson: LearnLesson, lang: string): string {
  if (lang === "ur") return lesson.title_ur;
  if (lang === "hi") return lesson.title_hi;
  return lesson.title_en;
}

export function wordMeaning(word: VocabWord, lang: string): string {
  if (lang === "ur") return word.ur;
  if (lang === "hi") return word.hi;
  return word.en;
}

export function completedCount(progress: LearnProgress, lessonIds: string[]): number {
  return lessonIds.filter((id) => progress.lessons[id]?.completed).length;
}

// Static JSON is served from the frontend origin, so these bypass lib/api —
// drive the top progress bar with the same event it uses.
async function fetchStaticJson<T>(url: string, notFound: string): Promise<T> {
  let shown = false;
  const grace = window.setTimeout(() => {
    shown = true;
    window.dispatchEvent(new CustomEvent("noor:page-loading", { detail: { active: true } }));
  }, 200);
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(notFound);
    return await r.json();
  } finally {
    window.clearTimeout(grace);
    if (shown) {
      window.dispatchEvent(new CustomEvent("noor:page-loading", { detail: { active: false } }));
    }
  }
}

export async function fetchLearnIndex(): Promise<LearnQuranIndex> {
  return fetchStaticJson("/data/learn-quran/index.json", "Course not found");
}

export async function fetchLessons(): Promise<Record<string, LearnLesson>> {
  return fetchStaticJson("/data/learn-quran/lessons.json", "Lessons not found");
}
