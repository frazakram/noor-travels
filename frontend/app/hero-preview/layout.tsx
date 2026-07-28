import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hero preview",
  robots: { index: false, follow: false },
  alternates: { canonical: null },
};

export default function HeroPreviewLayout({ children }: { children: React.ReactNode }) {
  return children;
}
