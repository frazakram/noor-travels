import { IbadahIndex } from "@/components/ibadah/IbadahIndex";
import { getAllGuides } from "@/lib/ibadah-content";
import { walkthroughSteps } from "@/lib/ibadah";

export default function IbadahPage() {
  // Only what the list shows is sent to the browser, not every guide's full content.
  const guides = getAllGuides().map((g) => ({
    slug: g.slug,
    group: g.group,
    title: g.title,
    summary: g.summary,
    status: g.status,
    steps: walkthroughSteps(g).length,
  }));
  return <IbadahIndex guides={guides} />;
}
