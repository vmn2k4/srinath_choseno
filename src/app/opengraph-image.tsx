import { renderOgCard, OG_IMAGE_SIZE, OG_IMAGE_CONTENT_TYPE } from "@/lib/utils/og";

export const alt = "Choseno — Your voice, heard where you live";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;

export default async function Image() {
  return renderOgCard({
    eyebrow: "Civic Platform",
    title: "Your voice, heard where you live",
    subtitle:
      "Choseno connects citizens and politicians inside real electoral boundaries.",
  });
}
