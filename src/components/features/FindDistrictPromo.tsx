import Link from "next/link";
import { MapPin } from "lucide-react";
import { Button } from "@/components/primitives";

// Same promo + styling the seat page shows above "Other Races in ..."
// (ElectionSeatPageClient), as a reusable server component.
export default function FindDistrictPromo({
  title = "Not sure which races are on your ballot?",
  description = "Find your district to see every race you can vote in, from mayor to MLA.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-primary/40 bg-gradient-to-br from-primary/15 via-accent/10 to-primary/5 p-4">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/20">
          <MapPin size={20} className="text-primary-light" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-text-main">{title}</p>
          <p className="mt-0.5 text-xs text-text-muted">{description}</p>
        </div>
      </div>
      <Button as={Link} href="/find-my-district" size="sm" className="shrink-0 gap-1.5">
        <MapPin size={14} /> Find Your District
      </Button>
    </div>
  );
}
