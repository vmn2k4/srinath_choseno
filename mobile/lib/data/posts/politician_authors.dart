// Port of hydratePoliticianAuthors (src/lib/services/feed.ts): posts by a
// politician carry only their ghost id, so look the real name + wall slug up
// in one query and let the UI show it instead of an anonymous label.
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/config/app_environment.dart';
import '../../domain/posts/entities/post.dart';

Future<Map<String, PoliticianAuthor>> fetchPoliticianAuthors(
  SupabaseClient client,
  Iterable<String> ghostIds,
) async {
  final ids = ghostIds.toSet().toList();
  if (ids.isEmpty) return const {};
  var query = client
      .from('profiles')
      .select('current_ghost_id, full_name, politician_profiles(wall_slug)')
      .eq('role', 'politician')
      .inFilter('current_ghost_id', ids);
  if (!AppEnvironment.isDev) query = query.eq('is_test', false);
  final rows = await query;
  final out = <String, PoliticianAuthor>{};
  for (final r in rows) {
    final ghost = r['current_ghost_id'] as String?;
    final name = r['full_name'] as String?;
    if (ghost == null || name == null || name.isEmpty) continue;
    final pp = r['politician_profiles'];
    final slug = (pp is List ? (pp.isEmpty ? null : pp.first) : pp);
    out[ghost] = PoliticianAuthor(
      fullName: name,
      wallSlug: slug is Map ? slug['wall_slug'] as String? : null,
    );
  }
  return out;
}

List<Post> withAuthors(
  List<Post> posts,
  Map<String, PoliticianAuthor> authors,
) => [
  for (final p in posts)
    authors[p.ghostId] == null ? p : p.copyWith(author: authors[p.ghostId]),
];
