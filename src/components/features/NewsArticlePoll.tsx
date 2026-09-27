"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, Check } from "lucide-react";
import { Spinner } from "@/components/primitives";
import { useAuth } from "@/contexts/AuthContext";
import { createClient } from "@/lib/supabase/client";
import {
  getNewsArticlePolls,
  getNewsArticlePollResults,
  getMyNewsArticlePollVotes,
  castNewsArticlePollVote,
  type NewsArticlePoll as PollData,
} from "@/lib/services/newsPolls";

// Reader-facing poll widget for a news article page -- an admin can attach
// any number of these to a story (see AdminNewsPollsEditor). Always shows
// the live tally as percentage bars (never gated behind "vote to see
// results") so a signed-out visitor gets the same read as everyone else;
// voting itself still requires sign-in, same as rating a politician
// (PoliticianInlineRating) or leaving a comment.
export default function NewsArticlePoll({ articleId }: { articleId: string }) {
  const supabase = createClient();
  const router = useRouter();
  const { user } = useAuth();

  const [polls, setPolls] = useState<PollData[]>([]);
  const [counts, setCounts] = useState<Map<string, number>>(new Map()); // option_id -> vote_count
  const [myVotes, setMyVotes] = useState<Map<string, string>>(new Map()); // poll_id -> option_id
  const [loading, setLoading] = useState(true);
  const [votingOptionId, setVotingOptionId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      setLoading(true);
      const { data: pollsData } = await getNewsArticlePolls(supabase, articleId);
      const activePolls = pollsData || [];
      if (!isMounted) return;
      setPolls(activePolls);

      const pollIds = activePolls.map((p) => p.id);
      const [{ data: resultsData }, { data: myVotesData }] = await Promise.all([
        getNewsArticlePollResults(supabase, pollIds),
        user ? getMyNewsArticlePollVotes(supabase, pollIds) : Promise.resolve({ data: [] }),
      ]);
      if (!isMounted) return;

      setCounts(new Map((resultsData || []).map((r) => [r.option_id, r.vote_count])));
      setMyVotes(new Map((myVotesData || []).map((v) => [v.poll_id, v.option_id])));
      setLoading(false);
    }
    load();
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articleId, user?.id]);

  const handleVote = async (pollId: string, optionId: string) => {
    if (!user) {
      router.push("/auth");
      return;
    }
    if (votingOptionId) return; // one in-flight vote at a time

    setVotingOptionId(optionId);
    // Optimistic: move this poll's tally from the old pick (if any) to the
    // new one before the round trip resolves, so the bars react instantly.
    const previousOptionId = myVotes.get(pollId);
    setCounts((prev) => {
      const next = new Map(prev);
      if (previousOptionId && previousOptionId !== optionId) {
        next.set(previousOptionId, Math.max(0, (next.get(previousOptionId) || 0) - 1));
      }
      if (previousOptionId !== optionId) {
        next.set(optionId, (next.get(optionId) || 0) + 1);
      }
      return next;
    });
    setMyVotes((prev) => new Map(prev).set(pollId, optionId));

    const { error } = await castNewsArticlePollVote(supabase, optionId);
    if (error) {
      // Roll back on failure -- re-fetch the real state rather than guess.
      const { data: resultsData } = await getNewsArticlePollResults(supabase, polls.map((p) => p.id));
      setCounts(new Map((resultsData || []).map((r) => [r.option_id, r.vote_count])));
      setMyVotes((prev) => {
        const next = new Map(prev);
        if (previousOptionId) next.set(pollId, previousOptionId);
        else next.delete(pollId);
        return next;
      });
    }
    setVotingOptionId(null);
  };

  // No spinner state here on purpose -- this is a small below-the-fold
  // widget, not the article's own load, so it simply appears once fetched
  // rather than reserving a loading slot every article would otherwise show.
  if (loading || polls.length === 0) return null;

  return (
    <div className="pt-5 border-t border-border-light/20 space-y-5">
      {polls.map((poll) => {
        const options = poll.news_article_poll_options ?? [];
        const totalVotes = options.reduce((sum, o) => sum + (counts.get(o.id) || 0), 0);
        const myVote = myVotes.get(poll.id);

        return (
          <div key={poll.id} className="p-4 rounded-2xl border border-border-light/40 bg-surface-elevated/60 space-y-3">
            <div className="flex items-center gap-2">
              <BarChart3 size={14} className="text-primary shrink-0" />
              <h3 className="text-sm font-bold text-text-main leading-snug">{poll.question}</h3>
            </div>

            <div className="space-y-2">
              {options.map((option) => {
                const voteCount = counts.get(option.id) || 0;
                const pct = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
                const isMine = myVote === option.id;
                const isVotingThis = votingOptionId === option.id;

                return (
                  <button
                    key={option.id}
                    type="button"
                    disabled={!!votingOptionId}
                    onClick={() => handleVote(poll.id, option.id)}
                    className={`relative w-full text-left rounded-xl border overflow-hidden transition-all disabled:cursor-default ${
                      isMine ? "border-primary" : "border-border-light/50 hover:border-primary/50"
                    }`}
                  >
                    <div
                      className={`absolute inset-y-0 left-0 transition-all duration-500 ${isMine ? "bg-primary/20" : "bg-surface-active/70"}`}
                      style={{ width: `${pct}%` }}
                    />
                    <div className="relative flex items-center justify-between gap-2 px-3 py-2.5">
                      <span className={`text-xs sm:text-sm font-semibold flex items-center gap-1.5 ${isMine ? "text-primary" : "text-text-main"}`}>
                        {isMine && <Check size={13} className="shrink-0" />}
                        {option.label}
                      </span>
                      <span className="text-xs font-bold text-text-muted shrink-0">
                        {isVotingThis ? <Spinner size="sm" /> : `${pct}%`}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            <p className="text-[11px] text-text-muted">
              {totalVotes === 0
                ? "No votes yet — be the first."
                : `${totalVotes.toLocaleString()} vote${totalVotes === 1 ? "" : "s"}`}
              {!user && " · Sign in to vote"}
            </p>
          </div>
        );
      })}
    </div>
  );
}
