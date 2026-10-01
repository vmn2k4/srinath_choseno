// Server-rendered JSON-LD. "<" is escaped so candidate/party names can't
// close the script tag (same escape the seat page uses).
export default function JsonLdScript({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
