-- Dedup registry for automated (Grok-driven) bulk news generation.
--
-- Problem: an admin can re-run the bulk news-import flow for the same
-- politician/scope (e.g. re-running "All MLAs, past 1 year" after adding
-- more MLAs later) and nothing stops the AI from generating a second
-- article about a real-world event it already covered -- article #2 would
-- have a different slug/headline than article #1 even though both cite the
-- same underlying source URL. Slug uniqueness on news_articles doesn't
-- catch this since the two slugs are legitimately different strings.
--
-- Fix: track every source URL already imported per-politician. Before
-- calling the AI, the exclusion list is passed into the prompt (so it
-- doesn't even try to regenerate that story); after the AI responds, every
-- article's sources[].url is re-checked against this table before insert
-- (never trust the prompt alone -- same reasoning as the enum CHECK
-- constraints mirroring the JS validation elsewhere in this app). PK on
-- (politician_id, source_url) makes the post-generation record step a
-- plain insert ON CONFLICT DO NOTHING, no read-then-write race.
CREATE TABLE IF NOT EXISTS public.news_import_source_urls (
  politician_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source_url      text NOT NULL,
  news_article_id uuid REFERENCES public.news_articles(id) ON DELETE SET NULL,
  imported_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (politician_id, source_url)
);

CREATE INDEX IF NOT EXISTS news_import_source_urls_article_idx
  ON public.news_import_source_urls (news_article_id);

COMMENT ON TABLE public.news_import_source_urls IS
  'Dedup registry for the automated bulk news-generation flow (see NewsImportAdminClient / api/admin/news-import). One row per (politician, real-world source URL already covered) -- re-running the import for the same politician/date-range must not regenerate an article about a story already imported.';

ALTER TABLE public.news_import_source_urls ENABLE ROW LEVEL SECURITY;

-- Admin-only in both directions -- this table is purely an internal
-- bookkeeping aid for the admin-only bulk-import flow (same trust tier as
-- news_articles/office_holders), nothing public ever reads it.
CREATE POLICY "Admins can read news import dedup registry"
  ON public.news_import_source_urls FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can write news import dedup registry"
  ON public.news_import_source_urls FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can delete news import dedup registry"
  ON public.news_import_source_urls FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
