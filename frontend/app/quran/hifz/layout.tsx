import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Hifz Planner — Memorise the Quran with Spaced Repetition",
  description:
    "Plan your Quran memorisation: a few ayahs at a time, reviewed on a spaced-repetition schedule, with recitation checks that score how well you know each passage.",
  path: "/quran/hifz",
});

export default function HifzLayout({ children }: { children: React.ReactNode }) {
  return children;
}
