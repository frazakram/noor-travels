import { SectionJsonLd } from "@/components/SectionJsonLd";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Learn Quran Online — Free Structured Course with Quizzes",
  description:
    "Learn to read and understand the Quran with a free structured course: placement test, step-by-step lessons, word-by-word examples, and quizzes that track your progress.",
  path: "/learn-quran",
});

export default function LearnQuranLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SectionJsonLd
        name="Learn Quran Online"
        description="Free structured Quran course with placement test, lessons and quizzes."
        path="/learn-quran"
      />
      {children}
    </>
  );
}
