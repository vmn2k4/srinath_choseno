import { ChevronDown } from "lucide-react";
import { Card } from "@/components/primitives";
import type { Faq } from "@/lib/utils/electionPartySeo";

// Visible FAQ. The same Q&A is emitted as FAQPage JSON-LD by the page --
// search engines only accept FAQ markup for content users can actually see,
// so every answer is rendered in the HTML (native <details>, no JS).
export default function FaqSection({ faqs, heading }: { faqs: Faq[]; heading: string }) {
  if (faqs.length === 0) return null;
  return (
    <section aria-labelledby="faq-heading">
      <h2 id="faq-heading" className="mb-3 text-xl font-bold text-text-main">
        {heading}
      </h2>
      <div className="space-y-2">
        {faqs.map((f) => (
          <Card key={f.q} variant="row" padding="none" as="details" className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 text-sm font-semibold text-text-main [&::-webkit-details-marker]:hidden">
              {f.q}
              <ChevronDown size={16} className="shrink-0 text-text-muted transition-transform group-open:rotate-180" />
            </summary>
            <p className="px-4 pb-4 text-sm leading-relaxed text-text-secondary">{f.a}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}
