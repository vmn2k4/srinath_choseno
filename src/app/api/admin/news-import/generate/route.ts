import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfileRole } from "@/lib/services/profile";
import {
  createNewsArticle,
  syncNewsArticlePoliticianTags,
  getImportedSourceUrlsForPoliticians,
  getExistingArticleTagsForPoliticians,
  recordImportedSourceUrls,
} from "@/lib/services/news";
import {
  getGrokBatchNewsPrompt,
  parseGrokJsonResponse,
  validateGrokBatchOutput,
  mapGeneratedArticleToInsert,
  extractSourceUrls,
  type NewsPromptPersonContext,
} from "@/lib/utils/grokNewsGeneration";

// Bulk news-import generation, one politician per request. Called in a
// client-driven sequential loop by NewsImportAdminClient (not a single
// giant server-side batch job) -- each call is short (one Grok request +
// a handful of inserts), so it stays well under any serverless function
// timeout even though the overall scope (e.g. "all MLAs") can be hundreds
// of people. See docs/CODE_LAYERS.md: this route is the only place that
// holds GROK_API_KEY -- it never reaches the browser.
//
// RLS on news_articles / news_article_politicians / news_import_source_urls
// is admin-only regardless, so the role check below is belt-and-suspenders
// (same pattern as api/admin/ga4/route.ts) rather than the only guard.

const GROK_API_KEY = process.env.GROK_API_KEY;

interface GenerateRequestBody {
  politicianId: string;
  politicianName: string;
  fromDate: string; // ISO date
  toDate: string; // ISO date
  status: "draft" | "published";
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await getProfileRole(supabase, user.id);
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!GROK_API_KEY) {
    return NextResponse.json({ error: "GROK_API_KEY is not configured on the server" }, { status: 500 });
  }

  let body: GenerateRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { politicianId, politicianName, fromDate, toDate, status } = body;
  if (!politicianId || !politicianName || !fromDate || !toDate) {
    return NextResponse.json(
      { error: "politicianId, politicianName, fromDate, toDate are required" },
      { status: 400 }
    );
  }
  if (status !== "draft" && status !== "published") {
    return NextResponse.json({ error: 'status must be "draft" or "published"' }, { status: 400 });
  }

  const person: NewsPromptPersonContext = { id: politicianId, name: politicianName };

  // ── 1. Dedup: union of (a) this pipeline's own import registry and
  // (b) any article already tagged to this politician regardless of how it
  // was created (manual /admin/news paste-JSON included) -- (a) alone would
  // miss stories an admin entered by hand, which never touch
  // news_import_source_urls. Both checked before generating (reduces
  // wasted Grok calls) and re-checked after (see validateGrokBatchOutput;
  // never trust the prompt alone). ─────────────────────────────────────
  const [{ data: importedData, error: importedErr }, { data: existingData, error: existingErr }] = await Promise.all([
    getImportedSourceUrlsForPoliticians(supabase, [politicianId]),
    getExistingArticleTagsForPoliticians(supabase, [politicianId]),
  ]);
  if (importedErr) {
    return NextResponse.json({ error: `Failed to load dedup registry: ${importedErr.message}` }, { status: 500 });
  }
  if (existingErr) {
    return NextResponse.json({ error: `Failed to load existing article tags: ${existingErr.message}` }, { status: 500 });
  }

  const excludeSourceUrls = Array.from(
    new Set([
      ...(importedData?.byPolitician.get(politicianId) ?? []),
      ...(existingData?.sourceUrlsByPolitician.get(politicianId) ?? []),
    ])
  );
  const excludeHeadlines = existingData?.headlinesByPolitician.get(politicianId) ?? [];

  // ── 2. Ask Grok, with the exclusion lists + date range baked into the prompt ──
  const prompt = getGrokBatchNewsPrompt(person, { fromDate, toDate, excludeSourceUrls, excludeHeadlines });

  let grokContent: string;
  try {
    const grokRes = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROK_API_KEY}` },
      body: JSON.stringify({
        // "grok-2" (the original placeholder) doesn't exist on this account
        // -- grok-4.6 is x.ai's current flagship (real-world knowledge +
        // structured outputs, which is what article generation needs;
        // grok-build-0.1 is coding-specific, not a fit here). Unconfirmed
        // against a live 200 response as of this writing -- the account's
        // billing/credits were blocking every call, including a plain
        // /v1/models list, so this couldn't be verified end-to-end. Re-test
        // once credits are available and fix the slug here if x.ai's actual
        // API identifier differs from this guess.
        model: "grok-4.6",
        temperature: 0.3,
        max_tokens: 8000,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!grokRes.ok) {
      const errText = await grokRes.text();
      return NextResponse.json({ error: `Grok API error ${grokRes.status}: ${errText.slice(0, 500)}` }, { status: 502 });
    }
    const grokJson = (await grokRes.json()) as { choices: Array<{ message: { content: string } }> };
    grokContent = grokJson.choices?.[0]?.message?.content ?? "";
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Failed to reach Grok: ${message}` }, { status: 502 });
  }

  // ── 3. Strict parse ──────────────────────────────────────────────────
  let parsed: { batch: any[] } | null;
  try {
    parsed = parseGrokJsonResponse(grokContent);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message, raw: grokContent.slice(0, 1000) }, { status: 422 });
  }

  if (!parsed) {
    return NextResponse.json({
      politicianId,
      politicianName,
      created: [],
      duplicates: [],
      failed: [],
      message: "No qualifying stories found in this date range.",
    });
  }

  // ── 4. Strict validation (schema + date range + dedup) ─────────────────
  const validation = validateGrokBatchOutput(parsed.batch, person, { fromDate, toDate, excludeSourceUrls });

  // ── 5. Insert only what passed, tag with the politician's OWN known UUID ──
  // (not anything parsed from the AI's output -- see grokNewsGeneration.ts)
  const created: Array<{ id: string; slug: string; headline: string }> = [];
  const insertFailed: Array<{ headline?: string; error: string }> = [];

  const passedIndices = new Set(
    parsed.batch
      .map((_, i) => i)
      .filter(
        (i) =>
          !validation.failedArticles.some((f) => f.index === i) &&
          !validation.duplicateArticles.some((d) => d.index === i)
      )
  );

  for (const index of passedIndices) {
    const item = parsed.batch[index];
    const eventDateIso = new Date(item.eventDate ?? item.event_date).toISOString();
    const insertData = mapGeneratedArticleToInsert(item, {
      status,
      eventDate: eventDateIso,
      publishedAt: status === "published" ? eventDateIso : null,
    });

    const { data, error } = await createNewsArticle(supabase, insertData);
    if (error || !data) {
      insertFailed.push({ headline: item.headline, error: error?.message ?? "Unknown insert error" });
      continue;
    }

    created.push({ id: data.id, slug: data.slug, headline: data.headline });

    // Tag with the politician's known UUID directly -- this is what makes
    // the article appear on their wall (admin_sync_news_article_tags RPC).
    const tagResult = await syncNewsArticlePoliticianTags(supabase, data.id, [politicianId]);
    if (tagResult.error) {
      insertFailed.push({ headline: item.headline, error: `Inserted but tag sync failed: ${tagResult.error.message}` });
    }

    // Record source URLs so a future re-run of this scope/range skips this story.
    const urls = extractSourceUrls(item);
    if (urls.length > 0) {
      await recordImportedSourceUrls(supabase, politicianId, data.id, urls);
    }
  }

  return NextResponse.json({
    politicianId,
    politicianName,
    created,
    duplicates: validation.duplicateArticles,
    failed: [...validation.failedArticles.map((f) => ({ headline: f.headline, error: f.errors.join("; ") })), ...insertFailed],
    warnings: validation.warnings,
  });
}
