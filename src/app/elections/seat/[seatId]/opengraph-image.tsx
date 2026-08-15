import { renderOgCard, OG_IMAGE_SIZE, OG_IMAGE_CONTENT_TYPE } from "@/lib/utils/og";
import { createPublicClient } from "@/lib/supabase/public";
import { getSeatById } from "@/lib/services/elections";

export const alt = "Election Seat | Choseno";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;
// Cookie-free createPublicClient (see src/lib/supabase/public.ts) keeps this
// route eligible for Next's static image caching; revalidate bounds how
// stale a cached card can get after the seat's data changes.
export const revalidate = 3600;

interface Props {
  params: Promise<{ seatId: string }>;
}

export default async function Image({ params }: Props) {
  const { seatId } = await params;
  const supabase = createPublicClient();
  const { data: seat } = await getSeatById(supabase, seatId);

  return renderOgCard({
    eyebrow: "Election Seat",
    title: seat?.role_title || "Electoral Seat",
    subtitle: seat?.map_shapes?.name || undefined,
  });
}
