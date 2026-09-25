import { timingSafeEqual } from "node:crypto";

/** True when no secret is configured, or when the given header matches it (constant time). */
export function embedSecretMatches(expected: string | undefined, given: string | null): boolean {
  if (!expected) return true;
  const a = Buffer.from(given ?? "");
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
