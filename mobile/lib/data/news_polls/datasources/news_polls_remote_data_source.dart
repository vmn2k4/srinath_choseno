// Port of the read/vote side of src/lib/services/newsPolls.ts. Definition
// tables (polls/options) are public-read via RLS gated on the parent
// article being published, same query shape works for both a signed-out
// visitor and an admin. Tallies and vote-casting go through the two RPCs
// below rather than a direct select/insert — see the migration
// (20260927000000_news_article_polls.sql) for why: `news_article_poll_votes`
// has no public read policy at all (only "own row"), so a live tally for
// everyone has to come from the SECURITY DEFINER results RPC, and a direct
// insert has no policy to satisfy either.
import 'package:supabase_flutter/supabase_flutter.dart';

class NewsPollsRemoteDataSource {
  const NewsPollsRemoteDataSource(this._client);

  final SupabaseClient _client;

  Future<List<dynamic>> getPollsForArticle(String articleId) {
    return _client
        .from('news_article_polls')
        .select(
          'id, news_article_id, question, sort_order, '
          'news_article_poll_options(id, label, sort_order)',
        )
        .eq('news_article_id', articleId)
        .order('sort_order')
        .order('sort_order', referencedTable: 'news_article_poll_options');
  }

  /// Per-option vote counts for however many polls the article has, via
  /// `get_news_article_poll_results` (SECURITY DEFINER) — bypasses the
  /// votes table's own-row-only read policy on purpose, but only ever
  /// returns a count, never a voter id.
  Future<List<dynamic>> getPollResults(List<String> pollIds) {
    if (pollIds.isEmpty) return Future.value(const []);
    return _client.rpc(
      'get_news_article_poll_results',
      params: {'p_poll_ids': pollIds},
    );
  }

  /// The signed-in caller's own vote on however many polls are on the page
  /// — plain select, no RPC needed: RLS ("Users can read their own poll
  /// vote") already restricts this to just their row.
  Future<List<dynamic>> getMyVotes(List<String> pollIds) {
    if (pollIds.isEmpty) return Future.value(const []);
    return _client
        .from('news_article_poll_votes')
        .select('poll_id, option_id')
        .inFilter('poll_id', pollIds);
  }

  Future<void> castVote(String optionId) {
    return _client.rpc(
      'cast_news_article_poll_vote',
      params: {'p_option_id': optionId},
    );
  }
}
