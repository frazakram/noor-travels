import type { Metadata } from "next";

// Lesson pages depend on client-side course state; keep them out of the index
// so crawlers don't see thin duplicates of /learn-quran.
export const metadata: Metadata = {
  title: "Lesson",
  robots: { index: false, follow: true },
  alternates: { canonical: null },
};

export default function LessonLayout({ children }: { children: React.ReactNode }) {
  return children;
}
