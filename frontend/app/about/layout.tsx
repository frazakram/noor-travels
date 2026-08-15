import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "About Noor Safar",
  description:
    "Noor Safar is a free Islamic companion app: Quran with translations, authentic Hadith, daily duas, prayer times with adhan alerts, live khutba translation and recitation practice — in English, Urdu and Hindi.",
  path: "/about",
});

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
