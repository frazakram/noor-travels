import { readFile } from "node:fs/promises";
import path from "node:path";
import { cache } from "react";
import { parseLibrarySlug } from "@/lib/library-slug";

export { librarySlug, slugify, parseLibrarySlug } from "@/lib/library-slug";

export type LibraryItem = {
  id: string;
  question: string;
  category: string;
  tags: string[];
  verified?: boolean;
  curated?: boolean;
};

type LibraryIndex = {
  version: number;
  total: number;
  categories: string[];
  items: LibraryItem[];
};

export type LibraryAnswer = {
  answer: string;
  citations: string[];
  sources: { ref: string; type: string; snippet: string; score?: number }[];
  confidence: string;
  verified?: boolean;
};

const DATA_DIR = path.join(process.cwd(), "public", "data");

/** Parsed once per server worker, not once per page — these files are 700KB/18MB. */
export const loadLibraryIndex = cache(async (): Promise<LibraryIndex> => {
  const raw = await readFile(path.join(DATA_DIR, "question-library-index.json"), "utf-8");
  return JSON.parse(raw);
});

const loadLibraryAnswers = cache(async (): Promise<Record<string, LibraryAnswer>> => {
  const raw = await readFile(path.join(DATA_DIR, "question-library-answers.json"), "utf-8");
  return JSON.parse(raw);
});

export async function getLibraryItem(
  slug: string,
): Promise<{ item: LibraryItem; answer: LibraryAnswer } | null> {
  const id = parseLibrarySlug(slug);
  if (!id) return null;
  const [index, answers] = await Promise.all([loadLibraryIndex(), loadLibraryAnswers()]);
  const item = index.items.find((i) => i.id === id);
  const answer = answers[id];
  if (!item || !answer) return null;
  return { item, answer };
}

export async function getCuratedLibraryItems(): Promise<LibraryItem[]> {
  const index = await loadLibraryIndex();
  return index.items.filter((i) => i.curated);
}

export async function getAllLibraryItems(): Promise<LibraryItem[]> {
  const index = await loadLibraryIndex();
  return index.items;
}

export async function getRelatedLibraryItems(item: LibraryItem, limit = 6): Promise<LibraryItem[]> {
  const index = await loadLibraryIndex();
  const tagSet = new Set(item.tags);
  return index.items
    .filter((i) => i.id !== item.id && i.category === item.category)
    .sort((a, b) => {
      const aOverlap = a.tags.filter((tg) => tagSet.has(tg)).length;
      const bOverlap = b.tags.filter((tg) => tagSet.has(tg)).length;
      return bOverlap - aOverlap;
    })
    .slice(0, limit);
}

export async function getLibraryItemsByTag(tag: string, limit = 6): Promise<LibraryItem[]> {
  const index = await loadLibraryIndex();
  return index.items.filter((i) => i.tags.includes(tag)).slice(0, limit);
}
