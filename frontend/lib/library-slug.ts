/** Pure string helpers for library permalinks — safe to import from client components. */

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

/** Full permalink slug for a library item, e.g. "q-0001-is-the-hijab-a-symbol-of-oppression". */
export function librarySlug(item: { id: string; question: string }): string {
  return `${item.id}-${slugify(item.question)}`;
}

const ID_PATTERN = /^([a-z]+-\d+)/;

/** Recovers the item id from a permalink slug, tolerant of a stale/incorrect trailing slug. */
export function parseLibrarySlug(slug: string): string | null {
  const match = ID_PATTERN.exec(slug);
  return match ? match[1] : null;
}
