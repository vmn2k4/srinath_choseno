import { renderOgCard, OG_IMAGE_SIZE, OG_IMAGE_CONTENT_TYPE } from "@/lib/utils/og";
import { createClient } from "@/lib/supabase/server";
import { getNewsArticleBySlug, type NewsArticle, type NewsArticleContent } from "@/lib/services/news";

export const alt = "Choseno News";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function Image({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await getNewsArticleBySlug(supabase, slug);
  const article = data as unknown as NewsArticle | null;

  if (!article) {
    return renderOgCard({ eyebrow: "Choseno News", title: "Article" });
  }

  const content = article.content as NewsArticleContent;

  return renderOgCard({
    eyebrow: "Choseno News",
    title: article.headline,
    subtitle: content?.metaDescription || article.summary || undefined,
    photoUrl: article.hero_image_url,
  });
}
