import { renderOgCard, OG_IMAGE_SIZE, OG_IMAGE_CONTENT_TYPE } from "@/lib/utils/og";

export const alt = "Active Elections | Choseno";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;

export default async function Image() {
  return renderOgCard({
    eyebrow: "Elections",
    title: "Active Elections",
    subtitle: "Discover open seats and candidates in your electoral boundaries.",
  });
}
