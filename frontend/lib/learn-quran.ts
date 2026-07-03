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
};

export type LearnProgress = {
  lessons: Record<string, LessonProgress>;
  streak: number;
  lastStudyDate?: string;
};

export function loadProgress(): LearnProgress {
  if (typeof window === "undefined") {
    return { lessons: {}, streak: 0 };
  }
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return { lessons: {}, streak: 0 };
    return JSON.parse(raw) as LearnProgress;
  } catch {
    return { lessons: {}, streak: 0 };
  }
}

export function saveProgress(progress: LearnProgress): void {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
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
  progress.lessons[lessonId] = {
    completed: true,
    score,
    lastStudied: new Date().toISOString(),
  };
  progress.streak = streak;
  progress.lastStudyDate = today;
  saveProgress(progress);
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

export async function fetchLearnIndex(): Promise<LearnQuranIndex> {
  const r = await fetch("/data/learn-quran/index.json");
  if (!r.ok) throw new Error("Course not found");
  return r.json();
}

export async function fetchLessons(): Promise<Record<string, LearnLesson>> {
  const r = await fetch("/data/learn-quran/lessons.json");
  if (!r.ok) throw new Error("Lessons not found");
  return r.json();
}
