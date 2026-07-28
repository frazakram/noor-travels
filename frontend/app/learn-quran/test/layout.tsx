import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Placement test",
  robots: { index: false, follow: true },
  alternates: { canonical: null },
};

export default function PlacementTestLayout({ children }: { children: React.ReactNode }) {
  return children;
}
