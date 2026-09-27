import 'package:supabase_flutter/supabase_flutter.dart' as supabase;

import '../../../core/errors/app_failure.dart';
import '../../../core/errors/result.dart';
import '../../../domain/news_polls/entities/news_article_poll.dart';
import '../../../domain/news_polls/repositories/news_polls_repository.dart';
import '../datasources/news_polls_remote_data_source.dart';
import '../models/news_article_poll_model.dart';

class NewsPollsRepositoryImpl implements NewsPollsRepository {
  const NewsPollsRepositoryImpl(this._remote);

  final NewsPollsRemoteDataSource _remote;

  @override
  Future<Result<List<NewsArticlePoll>>> getPollsForArticle(
    String articleId, {
    String? userId,
  }) async {
    try {
      final pollRows = await _remote.getPollsForArticle(articleId);
      final polls = pollRows.cast<Map<String, dynamic>>();
      final pollIds = polls.map((p) => p['id'] as String).toList();

      final results = await _remote.getPollResults(pollIds);
      final myVotes = userId != null
          ? await _remote.getMyVotes(pollIds)
          : const <dynamic>[];

      final countsByOption = <String, int>{
        for (final r in results.cast<Map<String, dynamic>>())
          r['option_id'] as String: (r['vote_count'] as num).toInt(),
      };
      final myVoteByPoll = <String, String>{
        for (final v in myVotes.cast<Map<String, dynamic>>())
          v['poll_id'] as String: v['option_id'] as String,
      };

      return Result.ok(
        polls
            .map((p) => p.toNewsArticlePoll(countsByOption, myVoteByPoll))
            .toList(),
      );
    } on supabase.PostgrestException catch (e) {
      return Result.err(ServerFailure(e.message, code: e.code));
    } catch (_) {
      return const Result.err(NetworkFailure());
    }
  }

  @override
  Future<Result<void>> castVote(String optionId) async {
    try {
      await _remote.castVote(optionId);
      return const Result.ok(null);
    } on supabase.PostgrestException catch (e) {
      return Result.err(ServerFailure(e.message, code: e.code));
    } catch (_) {
      return const Result.err(NetworkFailure());
    }
  }
}
