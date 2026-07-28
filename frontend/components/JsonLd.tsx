type Props = {
  data: Record<string, unknown> | Record<string, unknown>[];
};

/** Renders a schema.org JSON-LD script tag. Server-component safe. */
export function JsonLd({ data }: Props) {
  return (
    <script
      type="application/ld+json"
      // JSON-LD must be raw JSON inside a script tag; escape "<" to prevent
      // "</script>" breakout from any string content.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
