import { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import PostPermalinkClient from "@/components/features/PostPermalinkClient";
import { createPublicClient } from "@/lib/supabase/publicServer";
import { getPostById } from "@/lib/services/feed";
import { SITE_URL, SITE_NAME } from "@/lib/constants/site";

interface PostPageProps {
  params: Promise<{ id: string }>;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

const getPost = cache(async (id: string) => {
  if (!isUuid(id)) return null;
  const supabase = await createPublicClient();
  const { data } = await getPostById(supabase, id);
  return data;
});

// Shared links unfurl with the post text (and photo, if any).
export async function generateMetadata({ params }: PostPageProps): Promise<Metadata> {
  const { id } = await params;
  const post = await getPost(id);
  if (!post) return { title: `Post not found | ${SITE_NAME}` };
  const text = (post.content || "").replace(/\s+/g, " ").trim();
  const title = text ? `${text.slice(0, 70)}${text.length > 70 ? "…" : ""} | ${SITE_NAME}` : `A post on ${SITE_NAME}`;
  const description = text.slice(0, 200) || "Join the conversation on Choseno.";
  const url = `${SITE_URL}/post/${id}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    // Individual posts are user content: shareable, not search-indexed.
    robots: { index: false, follow: true },
    openGraph: { title, description, url, type: "article", ...(post.image_url ? { images: [post.image_url] } : {}) },
    twitter: { card: post.image_url ? "summary_large_image" : "summary", title, description },
  };
}

export default async function PostPage({ params }: PostPageProps) {
  const { id } = await params;
  const post = await getPost(id);
  if (!post) notFound();
  return <PostPermalinkClient postId={id} />;
}
