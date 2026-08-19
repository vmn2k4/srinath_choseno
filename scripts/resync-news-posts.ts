/**
 * Resync all news article wall posts with their OG images (hero_image_url)
 *
 * This script updates posts that were created before their OG images were
 * generated, ensuring they now have image_url set to hero_image_url.
 *
 * Usage: npx ts-node scripts/resync-news-posts.ts
 */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error("Error: Missing SUPABASE_SERVICE_ROLE_KEY in .env.local");
  console.error(
    "Please set SUPABASE_SERVICE_ROLE_KEY to your Supabase service role key"
  );
  process.exit(1);
}

const supabase = createClient<Database>(supabaseUrl, supabaseServiceRoleKey);

async function resyncNewsPostsWithOGImages() {
  try {
    console.log("Fetching news articles with wall posts...");

    // Get all published news articles with tagged politicians and OG images
    const { data: articles, error: articlesError } = await supabase
      .from("news_articles")
      .select("id, headline, hero_image_url")
      .eq("status", "published")
      .not("hero_image_url", "is", null);

    if (articlesError) {
      throw new Error(`Failed to fetch articles: ${articlesError.message}`);
    }

    if (!articles || articles.length === 0) {
      console.log("No published articles with OG images found");
      return;
    }

    console.log(`Found ${articles.length} published articles with OG images`);

    // Get current posts with missing image_url
    const { data: postsNeedingUpdate, error: postsError } = await supabase
      .from("posts")
      .select("id, news_article_id, headline")
      .eq("ghost_id", "00000000-0000-0000-0000-000000000001")
      .in(
        "news_article_id",
        articles.map((a) => a.id)
      )
      .is("image_url", null);

    if (postsError) {
      console.warn(`Warning: Failed to fetch posts: ${postsError.message}`);
    } else if (postsNeedingUpdate && postsNeedingUpdate.length > 0) {
      console.log(
        `Found ${postsNeedingUpdate.length} posts without images to update`
      );
    }

    // Update posts for each article
    let updatedCount = 0;
    for (const article of articles) {
      const { data, error: updateError } = await supabase
        .from("posts")
        .update({ image_url: article.hero_image_url })
        .eq("news_article_id", article.id)
        .eq("ghost_id", "00000000-0000-0000-0000-000000000001")
        .select("id");

      if (updateError) {
        console.warn(
          `Warning: Failed to update posts for article ${article.id}: ${updateError.message}`
        );
      } else {
        const count = data?.length || 0;
        updatedCount += count;
        if (count > 0) {
          console.log(`✓ Updated ${count} post(s) for: ${article.headline}`);
        }
      }
    }

    console.log(`\n✅ Resync complete! Updated ${updatedCount} post(s)`);
    if (updatedCount > 0) {
      console.log(
        "News posts should now display OG images in politician walls"
      );
    }
  } catch (error) {
    console.error(
      "Error during resync:",
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }
}

resyncNewsPostsWithOGImages();
