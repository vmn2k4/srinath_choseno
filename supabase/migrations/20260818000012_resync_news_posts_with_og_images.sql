-- Resync all news article wall posts with their current hero_image_url values
-- This fixes the issue where posts created before OG images were generated
-- don't display the OG card image in politician walls

-- Update all existing news article posts to have the latest hero_image_url
UPDATE public.posts
SET image_url = na.hero_image_url
FROM public.news_articles na
WHERE posts.news_article_id = na.id
  AND posts.ghost_id = '00000000-0000-0000-0000-000000000001'
  AND (posts.image_url IS NULL OR posts.image_url != na.hero_image_url);

-- Log the sync
DO $$
BEGIN
  RAISE NOTICE 'News article wall posts resynced with OG images (hero_image_url)';
END $$;
