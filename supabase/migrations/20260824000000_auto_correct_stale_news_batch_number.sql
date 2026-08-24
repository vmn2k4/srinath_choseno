-- Self-heals a recurring bug in the external news-generation pipeline: it
-- stamps each inserted article's content->>'batch_number' with a tag, but
-- on repeat runs it has been observed reusing an OLD tag (e.g. a run from
-- days ago) instead of minting a fresh one for the new run. Symptom: the
-- Admin > News Distribution "Batch" dropdown
-- (AdminNewsDistributionClient.tsx, backed by listDistinctBatches() /
-- listNewsArticlesForDistribution() in src/lib/services/news.ts, both of
-- which group/filter strictly by content->>'batch_number') silently merges
-- brand-new articles into a days-old batch entry instead of surfacing a new
-- one -- confirmed live on 2026-08-24: a run stamped "2026-08-21 08:00" was
-- actually inserted 3 days later.
--
-- We don't have access to that pipeline's source to fix the root cause, so
-- per this repo's layering rule (docs/CODE_LAYERS.md: correctness-critical
-- invariants belong in the backend, since client/upstream checks can be
-- wrong or bypassed), we enforce freshness here instead of hand-patching
-- the data after every run.
--
-- Logic: on INSERT, if the incoming batch_number tag was last used more
-- than STALE_AFTER ago, treat it as a stale reuse and mint a fresh tag from
-- now() instead. To keep every row of the SAME new run grouped under one
-- tag (a run inserts ~1 row/few seconds, one INSERT per row -- see above),
-- we stash which stale tag a correction came from in
-- content->>'batch_number_corrected_from', and a later row presented with
-- the same stale tag reuses the most recent still-fresh correction rather
-- than minting its own.
CREATE OR REPLACE FUNCTION public.auto_correct_stale_news_batch_number()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  stale_after CONSTANT interval := interval '10 minutes';
  v_batch text;
  v_last_used timestamptz;
  v_reuse_batch text;
BEGIN
  v_batch := NULLIF(trim(NEW.content->>'batch_number'), '');
  IF v_batch IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT max(created_at) INTO v_last_used
    FROM public.news_articles
   WHERE content->>'batch_number' = v_batch;

  -- Never used before, or used recently -- this is a legitimate tag
  -- (either the true first row of a fresh batch, or a later row of one
  -- already in progress). Leave it alone.
  IF v_last_used IS NULL OR v_last_used >= now() - stale_after THEN
    RETURN NEW;
  END IF;

  -- Stale reuse detected. Check whether another row already corrected
  -- this same stale tag moments ago (same in-progress run) so we reuse its
  -- new tag instead of splintering one run across several new tags.
  SELECT content->>'batch_number' INTO v_reuse_batch
    FROM public.news_articles
   WHERE content->>'batch_number_corrected_from' = v_batch
     AND created_at >= now() - stale_after
   ORDER BY created_at DESC
   LIMIT 1;

  IF v_reuse_batch IS NOT NULL THEN
    NEW.content := jsonb_set(NEW.content, '{batch_number}', to_jsonb(v_reuse_batch));
  ELSE
    NEW.content := jsonb_set(
      NEW.content,
      '{batch_number}',
      to_jsonb(to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI'))
    );
    NEW.content := jsonb_set(NEW.content, '{batch_number_corrected_from}', to_jsonb(v_batch));
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_correct_stale_news_batch_number ON public.news_articles;
CREATE TRIGGER trg_auto_correct_stale_news_batch_number
  BEFORE INSERT ON public.news_articles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_correct_stale_news_batch_number();
