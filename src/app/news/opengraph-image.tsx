import { renderOgCard, OG_IMAGE_SIZE, OG_IMAGE_CONTENT_TYPE } from "@/lib/utils/og";

export const alt = "Civic News & Updates | Choseno";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;

export default async function Image() {
  return renderOgCard({
    eyebrow: "Choseno News",
    title: "Civic News & Updates",
    subtitle: "Electoral boundary updates and democratic technology, explained.",
  });
}
