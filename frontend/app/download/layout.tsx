import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Download the Noor Safar Android App",
  description:
    "Install the Noor Safar Android app for prayer times, adhan notifications, offline Quran reading and live khutba translation. Direct APK download.",
  path: "/download",
});

export default function DownloadLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
