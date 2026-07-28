import { JsonLd } from "@/components/JsonLd";
import { SITE_URL } from "@/lib/seo";

type Props = {
  name: string;
  description: string;
  path: string;
};

/** WebPage + BreadcrumbList schema for a top-level section page. */
export function SectionJsonLd({ name, description, path }: Props) {
  return (
    <JsonLd
      data={[
        {
          "@context": "https://schema.org",
          "@type": "WebPage",
          name,
          description,
          url: `${SITE_URL}${path}`,
          isPartOf: { "@id": `${SITE_URL}/#website` },
        },
        {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
            { "@type": "ListItem", position: 2, name, item: `${SITE_URL}${path}` },
          ],
        },
      ]}
    />
  );
}
