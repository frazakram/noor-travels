import { readFile } from "node:fs/promises";
import path from "node:path";
import { cache } from "react";
import { answerShardPath } from "@/lib/library-shards";
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

let indexPromise: Promise<LibraryIndex> | null = null;

/** Module-level memo: React cache() only lives for one request, and the index is ~700KB. */
export const loadLibraryIndex = cache((): Promise<LibraryIndex> => {
  indexPromise ??= readFile(path.join(DATA_DIR, "question-library-index.json"), "utf-8")
    .then((raw) => JSON.parse(raw) as LibraryIndex)
    .catch((err) => {
      indexPromise = null;
      throw err;
    });
  return indexPromise;
});

async function loadAnswer(id: string): Promise<LibraryAnswer | undefined> {
  const raw = await readFile(path.join(process.cwd(), "public", answerShardPath(id)), "utf-8");
  return (JSON.parse(raw) as Record<string, LibraryAnswer>)[id];
}

export async function getLibraryItem(
  slug: string,
): Promise<{ item: LibraryItem; answer: LibraryAnswer } | null> {
  const id = parseLibrarySlug(slug);
  if (!id) return null;
  const [index, answer] = await Promise.all([loadLibraryIndex(), loadAnswer(id)]);
  const item = index.items.find((i) => i.id === id);
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
