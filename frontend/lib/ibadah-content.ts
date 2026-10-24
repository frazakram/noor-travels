/**
 * Server-side only (uses fs): reads the Ibadah Guide content (content/ibadah/*.json) at build time, so the
 * guide pages are static HTML: instant, crawlable, and free to serve.
 */
import fs from "node:fs";
import path from "node:path";
import type { IbadahGuide } from "@/lib/ibadah";

const DIR = path.join(process.cwd(), "content", "ibadah");

export function getAllGuides(): IbadahGuide[] {
  return fs
    .readdirSync(DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8")) as IbadahGuide)
    .sort((a, b) => a.order - b.order);
}

export function getGuide(slug: string): IbadahGuide | null {
  return getAllGuides().find((g) => g.slug === slug) ?? null;
}
