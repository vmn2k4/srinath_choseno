"use client";

import { useEffect, useState } from "react";
import { BarChart3, Plus, Trash2 } from "lucide-react";
import { Button, Input, Textarea, Spinner } from "@/components/primitives";
import { createClient } from "@/lib/supabase/client";
import {
  getNewsArticlePolls,
  getNewsArticlePollResults,
  createNewsArticlePoll,
  deleteNewsArticlePoll,
  type NewsArticlePoll,
} from "@/lib/services/newsPolls";

// Admin authoring UI for reader polls on a news article (see
// NewsArticlePoll for the public-facing widget and migration
// 20260927000000_news_article_polls.sql for the schema). Only usable once
// the article itself has been saved -- a poll needs a real news_article_id
// to attach to, so this only ever renders while editingId is set, never for
// a brand-new unsaved draft. Deliberately its own file/component rather than
// folded into AdminNewsPageClient's giant form: polls are a separate DB
// entity (not part of the article's `content` JSONB), so they don't need to
// participate in that form's save/JSON-paste/batch-import plumbing at all.
export default function AdminNewsPollsEditor({ articleId }: { articleId: string }) {
  const supabase = createClient();

  const [polls, setPolls] = useState<NewsArticlePoll[]>([]);
  const [counts, setCounts] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [question, setQuestion] = useState("");
  const [optionsText, setOptionsText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    const { data: pollsData } = await getNewsArticlePolls(supabase, articleId);
    const activePolls = pollsData || [];
    setPolls(activePolls);
    const { data: resultsData } = await getNewsArticlePollResults(supabase, activePolls.map((p) => p.id));
    setCounts(new Map((resultsData || []).map((r) => [r.option_id, r.vote_count])));
    setLoading(false);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articleId]);

  const handleAdd = async () => {
    const labels = optionsText.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!question.trim()) {
      setError("Enter a question first.");
      return;
    }
    if (labels.length < 2) {
      setError("Add at least two options (one per line).");
      return;
    }
    setSaving(true);
    setError("");
    const { error: createError } = await createNewsArticlePoll(supabase, articleId, question.trim(), labels, polls.length);
    setSaving(false);
    if (createError) {
      setError(createError.message || "Failed to create poll.");
      return;
    }
    setQuestion("");
    setOptionsText("");
    setAdding(false);
    load();
  };

  const handleDelete = async (pollId: string) => {
    if (!confirm("Delete this poll and all its votes? This can't be undone.")) return;
    await deleteNewsArticlePoll(supabase, pollId);
    load();
  };

  return (
    <div className="rounded-2xl border border-border-light/30 overflow-hidden" style={{ backgroundColor: "var(--color-surface)" }}>
      <div className="w-full flex items-center justify-between gap-2 px-5 py-4 text-sm font-semibold text-text-main">
        <span className="flex items-center gap-2">
          <BarChart3 size={14} /> Reader Polls
        </span>
        {!adding && (
          <Button size="sm" variant="ghost" onClick={() => setAdding(true)}>
            <Plus size={13} /> Add Poll
          </Button>
        )}
      </div>

      <div className="px-5 pb-5 space-y-4">
        {loading ? (
          <div className="flex justify-center py-3">
            <Spinner size="sm" />
          </div>
        ) : (
          <>
            {polls.length === 0 && !adding && (
              <p className="text-xs text-text-muted italic">No polls on this article yet.</p>
            )}

            {polls.map((poll) => {
              const options = poll.news_article_poll_options ?? [];
              const total = options.reduce((sum, o) => sum + (counts.get(o.id) || 0), 0);
              return (
                <div key={poll.id} className="p-3 rounded-xl border border-border-light/30 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-text-main">{poll.question}</p>
                    <button
                      type="button"
                      onClick={() => handleDelete(poll.id)}
                      className="p-1 rounded-lg text-danger/70 hover:text-danger hover:bg-danger/10 transition-colors shrink-0"
                      title="Delete poll"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <ul className="space-y-1">
                    {options.map((o) => (
                      <li key={o.id} className="flex items-center justify-between text-xs text-text-secondary">
                        <span>{o.label}</span>
                        <span className="text-text-muted font-semibold">{counts.get(o.id) || 0} votes</span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-[11px] text-text-muted">{total} total vote{total === 1 ? "" : "s"}</p>
                </div>
              );
            })}

            {adding && (
              <div className="p-3 rounded-xl border border-border-light/30 space-y-2.5">
                <Input
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Which party do you support?"
                />
                <Textarea
                  value={optionsText}
                  onChange={(e) => setOptionsText(e.target.value)}
                  placeholder={"One option per line, e.g.\nBC NDP\nBC Conservatives\nBC Greens"}
                  rows={4}
                  className="text-sm"
                />
                {error && <p className="text-danger text-xs font-semibold">{error}</p>}
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => { setAdding(false); setError(""); }}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleAdd} disabled={saving}>
                    {saving ? <Spinner size="sm" /> : <Plus size={13} />}
                    {saving ? "Saving…" : "Save Poll"}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
