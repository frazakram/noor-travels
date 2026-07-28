import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Module quiz",
  robots: { index: false, follow: true },
  alternates: { canonical: null },
};

export default function ModuleQuizLayout({ children }: { children: React.ReactNode }) {
  return children;
}
