import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Privacy",
  description:
    "How Noor Safar handles your data: no ads, no analytics, no tracking. What stays on your device, what is sent to which service, and how to delete your account.",
  path: "/privacy",
});

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
