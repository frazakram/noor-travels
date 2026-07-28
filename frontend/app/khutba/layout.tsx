import { SectionJsonLd } from "@/components/SectionJsonLd";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Live Khutba Translation — Understand the Friday Sermon",
  description:
    "Point your phone at the Friday khutba and get a live transcription with instant translation into English, Urdu or Hindi, plus a library of classic khutbahs to read.",
  path: "/khutba",
});

export default function KhutbaLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SectionJsonLd
        name="Live Khutba Translation"
        description="Live transcription and translation of the Friday khutba into English, Urdu or Hindi."
        path="/khutba"
      />
      {children}
    </>
  );
}
