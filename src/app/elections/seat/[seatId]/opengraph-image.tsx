import { renderOgCard, OG_IMAGE_SIZE, OG_IMAGE_CONTENT_TYPE } from "@/lib/utils/og";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { getSeatById } from "@/lib/services/elections";

export const alt = "Election Seat | Choseno";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;

interface Props {
  params: Promise<{ seatId: string }>;
}

export default async function Image({ params }: Props) {
  const { seatId } = await params;
  const supabase = await createServerClient();
  const { data: seat } = await getSeatById(supabase, seatId);

  return renderOgCard({
    eyebrow: "Election Seat",
    title: seat?.role_title || "Electoral Seat",
    subtitle: seat?.map_shapes?.name || undefined,
  });
}
