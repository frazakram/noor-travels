import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Settings",
  robots: { index: false, follow: false },
  alternates: { canonical: null },
};

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
