"use client";

import React, { useState, useEffect, useCallback } from "react";
import AdminSubNav from "./AdminSubNav";
import PostCard, { PostWithComments, type PostMention } from "./PostCard";
import {
  getAllPostsAdmin,
  hydratePoliticianAuthors,
  hydratePostMentions,
} from "@/lib/services/feed";
import { Button, Spinner, PageHeader, Badge } from "@/components/primitives";
import { createClient } from "@/lib/supabase/client";

// The news/import bot account that wrote ~5K wall posts; hidden by default.
const NEWS_BOT_GHOST_ID = "00000000-0000-0000-0000-000000000001";
const PAGE_SIZE = 50;

type PoliticianAuthor = { fullName: string; wallHref: string };

export default function PostsAdminClient() {
  const supabase = createClient();

  const [posts, setPosts] = useState<PostWithComments[]>([]);
  const [politicianAuthors, setPoliticianAuthors] = useState<Map<string, PoliticianAuthor>>(new Map());
  const [postMentions, setPostMentions] = useState<Map<string, PostMention[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [includeBot, setIncludeBot] = useState(false);

  const load = useCallback(
    async (offset: number) => {
      setLoading(true);
      const { data } = await getAllPostsAdmin(supabase, {
        limit: PAGE_SIZE,
        offset,
        excludeGhostId: includeBot ? undefined : NEWS_BOT_GHOST_ID,
      });
      const batch = (data || []) as PostWithComments[];
      const [authors, mentions] = await Promise.all([
        hydratePoliticianAuthors(supabase, batch),
        hydratePostMentions(supabase, batch),
      ]);
      setPosts((prev) => (offset === 0 ? batch : [...prev, ...batch]));
      setPoliticianAuthors((prev) => new Map([...prev, ...authors]));
      setPostMentions((prev) => new Map([...prev, ...mentions]));
      setHasMore(batch.length === PAGE_SIZE);
      setLoading(false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [includeBot]
  );

  useEffect(() => {
    load(0);
  }, [load]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <PageHeader title="Posts" subtitle="Every post made on the platform, newest first." />
      <AdminSubNav active="posts" />

      <label className="flex items-center gap-2 text-sm text-text-muted">
        <input type="checkbox" checked={includeBot} onChange={(e) => setIncludeBot(e.target.checked)} />
        Include news-bot wall posts
      </label>

      <div className="space-y-4">
        {posts.map((post) => (
          <div key={post.id} className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
              <span>{new Date(post.created_at ?? "").toLocaleString()}</span>
              {post.wall_ghost_id && <Badge>Wall post</Badge>}
              {post.removed_at && <Badge>Removed{post.removed_reason ? `: ${post.removed_reason}` : ""}</Badge>}
              {post.is_test && <Badge>Test</Badge>}
            </div>
            <PostCard
              post={post}
              showVoteBar={false}
              canComment={false}
              commentValue=""
              onCommentChange={() => {}}
              onSubmitComment={() => {}}
              politicianAuthor={politicianAuthors.get(post.ghost_id) ?? null}
              mentions={postMentions.get(post.id)}
            />
          </div>
        ))}
      </div>

      {loading && <Spinner />}
      {!loading && posts.length === 0 && <p className="text-sm text-text-muted">No posts found.</p>}
      {!loading && hasMore && (
        <Button variant="secondary" onClick={() => load(posts.length)}>
          Load more
        </Button>
      )}
    </div>
  );
}
