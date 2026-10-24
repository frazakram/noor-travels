import { notFound } from "next/navigation";
import { IbadahGuideView } from "@/components/ibadah/IbadahGuideView";
import { getAllGuides, getGuide } from "@/lib/ibadah-content";
import { pageMetadata } from "@/lib/seo";

export const dynamicParams = false;

export function generateStaticParams() {
  return getAllGuides().map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) return {};
  return pageMetadata({
    title: `How to Perform ${guide.title.en} — Step by Step (Hanafi)`,
    description: guide.summary.en,
    path: `/ibadah/${guide.slug}`,
  });
}

export default async function IbadahGuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) notFound();
  return <IbadahGuideView guide={guide} />;
}
